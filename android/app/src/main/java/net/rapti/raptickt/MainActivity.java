package net.rapti.raptickt;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.ActivityManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * RaptiCKT host activity. The simulator itself is a self-contained web
 * application bundled in assets/www and rendered by a hardware-accelerated
 * WebView; this class provides the native bridge (files, sharing, haptics).
 */
public class MainActivity extends Activity {

    private static final int REQ_SAVE = 41;
    private static final int REQ_OPEN = 42;
    private static final int BG = Color.parseColor("#0B1120");

    private WebView web;
    private FrameLayout root;
    private String lastCut = "";
    private byte[] pendingSave;
    private String pendingOpenName;
    private String pendingOpenText;
    private boolean pageReady;
    private boolean immersive;
    private final Handler ui = new Handler(Looper.getMainLooper());

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);

        root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        web = new WebView(this);
        web.setBackgroundColor(BG);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        // Edge-to-edge (enforced on Android 15): pad content away from system bars, cutouts and the keyboard.
        // In full screen the page runs edge to edge, under the camera cutout too; the cutout size is
        // handed to the page (--cut-t/r/b/l) so it can keep its own buttons clear of it.
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int l, t, r, b;
            if (immersive) {
                int imeB = Build.VERSION.SDK_INT >= 30 ? insets.getInsets(WindowInsets.Type.ime()).bottom : 0;
                v.setPadding(0, 0, 0, imeB);
                sendCutout(insets);
                return insets;
            }
            sendCutout(null);
            if (Build.VERSION.SDK_INT >= 30) {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets ime = insets.getInsets(WindowInsets.Type.ime());
                l = bars.left; t = bars.top; r = bars.right; b = Math.max(bars.bottom, ime.bottom);
            } else {
                l = insets.getSystemWindowInsetLeft(); t = insets.getSystemWindowInsetTop();
                r = insets.getSystemWindowInsetRight(); b = insets.getSystemWindowInsetBottom();
            }
            v.setPadding(l, t, r, b);
            return insets;
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        web.addJavascriptInterface(new Bridge(), "RaptiAndroid");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("file".equals(u.getScheme())) return false;
                openExternal(u.toString());
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                lastCut = "";
                root.requestApplyInsets();
                ui.postDelayed(MainActivity.this::deliverPendingOpen, 600);
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl("file:///android_asset/www/index.html");
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        web.evaluateJavascript("window.raptiPause && window.raptiPause()", null);
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        if (immersive) applyImmersive(true);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && immersive) applyImmersive(true); // bars come back after dialogs and pickers
    }

    /** Tells the page how far the camera cutout reaches into each edge (CSS px), or 0 outside full screen. */
    private void sendCutout(WindowInsets insets) {
        float d = getResources().getDisplayMetrics().density;
        int t = 0, r = 0, b = 0, l = 0;
        if (insets != null && Build.VERSION.SDK_INT >= 28 && insets.getDisplayCutout() != null) {
            android.view.DisplayCutout c = insets.getDisplayCutout();
            t = Math.round(c.getSafeInsetTop() / d); r = Math.round(c.getSafeInsetRight() / d);
            b = Math.round(c.getSafeInsetBottom() / d); l = Math.round(c.getSafeInsetLeft() / d);
        }
        String js = "(function(s){s.setProperty('--cut-t','" + t + "px');s.setProperty('--cut-r','" + r + "px');s.setProperty('--cut-b','" + b + "px');s.setProperty('--cut-l','" + l + "px')})(document.documentElement.style)";
        if (js.equals(lastCut)) return;
        lastCut = js;
        if (web != null) web.evaluateJavascript(js, null);
    }

    /** Full screen: hide the status and navigation bars (a swipe from the edge shows them briefly). */
    @SuppressWarnings("deprecation")
    private void applyImmersive(boolean on) {
        immersive = on;
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.layoutInDisplayCutoutMode = on ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                    : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;
            w.setAttributes(lp);
        }
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                if (on) {
                    c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    c.hide(WindowInsets.Type.systemBars());
                } else {
                    c.show(WindowInsets.Type.systemBars());
                }
            }
        } else {
            View decor = w.getDecorView();
            decor.setSystemUiVisibility(on ? View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY : View.SYSTEM_UI_FLAG_VISIBLE);
        }
        if (root != null) root.post(root::requestApplyInsets); // re-pad: edge to edge in full screen
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("RaptiAndroid");
            web.destroy();
        }
        super.onDestroy();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.raptiBack && window.raptiBack()) ? 'yes' : 'no'", value -> {
            if (value == null || !value.contains("yes")) MainActivity.super.onBackPressed();
        });
    }

    // ------------------------------------------------------------ intents
    private void handleIntent(Intent intent) {
        if (intent == null) return;
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(intent.getAction())) uri = intent.getData();
        else if (Intent.ACTION_SEND.equals(intent.getAction())) uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (uri == null) return;
        try {
            pendingOpenText = new String(readAll(uri), "UTF-8");
            pendingOpenName = displayName(uri);
            if (pageReady) deliverPendingOpen();
        } catch (Exception e) {
            Toast.makeText(this, "Could not open file", Toast.LENGTH_SHORT).show();
        }
    }

    private void deliverPendingOpen() {
        if (pendingOpenText == null) return;
        String js = "window.raptiOpenText && window.raptiOpenText(" + JSONObject.quote(pendingOpenName == null ? "circuit.rckt" : pendingOpenName)
                + "," + JSONObject.quote(pendingOpenText) + ")";
        pendingOpenText = null;
        web.evaluateJavascript(js, null);
    }

    private byte[] readAll(Uri uri) throws Exception {
        try (InputStream in = getContentResolver().openInputStream(uri); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (in == null) throw new Exception("stream");
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                if (out.size() > 20 * 1024 * 1024) throw new Exception("too large");
            }
            return out.toByteArray();
        }
    }

    private String displayName(Uri uri) {
        try (Cursor c = getContentResolver().query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (i >= 0) return c.getString(i);
            }
        } catch (Exception ignored) { }
        String p = uri.getLastPathSegment();
        return p == null ? "circuit.rckt" : p;
    }

    private void openExternal(String url) {
        try {
            Intent i = url.startsWith("tel:") ? new Intent(Intent.ACTION_DIAL, Uri.parse(url)) : new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No app available to open this link", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_SAVE) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingSave != null) {
                try (OutputStream os = getContentResolver().openOutputStream(data.getData(), "wt")) {
                    if (os != null) os.write(pendingSave);
                    Toast.makeText(this, "Saved", Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Toast.makeText(this, "Save failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            }
            pendingSave = null;
        } else if (requestCode == REQ_OPEN) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                try {
                    Uri uri = data.getData();
                    String b64 = Base64.encodeToString(readAll(uri), Base64.NO_WRAP);
                    web.evaluateJavascript("window.__raptiFileOpened && window.__raptiFileOpened(" + JSONObject.quote(displayName(uri)) + ",'" + b64 + "')", null);
                } catch (Exception e) {
                    web.evaluateJavascript("window.__raptiFileError && window.__raptiFileError(" + JSONObject.quote(String.valueOf(e.getMessage())) + ")", null);
                }
            } else {
                web.evaluateJavascript("window.__raptiFileError && window.__raptiFileError('cancelled')", null);
            }
        }
    }

    // ------------------------------------------------------------- bridge
    private final class Bridge {
        /** Hardware facts the web app uses to pick smooth or simple animations. */
        @JavascriptInterface
        public String deviceInfo() {
            JSONObject o = new JSONObject();
            try {
                ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
                ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
                am.getMemoryInfo(mi);
                o.put("ramMB", mi.totalMem / (1024 * 1024));
                o.put("lowRam", am.isLowRamDevice());
                o.put("cores", Runtime.getRuntime().availableProcessors());
                o.put("sdk", Build.VERSION.SDK_INT);
                o.put("perfClass", Build.VERSION.SDK_INT >= 31 ? Build.VERSION.MEDIA_PERFORMANCE_CLASS : 0);
                o.put("hz", (double) getWindowManager().getDefaultDisplay().getRefreshRate());
            } catch (Exception ignored) {
                // whatever was collected so far is still useful
            }
            return o.toString();
        }

        @JavascriptInterface
        public String appVersion() {
            try {
                PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
                return "Android " + pi.versionName;
            } catch (Exception e) {
                return "Android";
            }
        }

        @JavascriptInterface
        public void vibrate(int ms) {
            Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            v.vibrate(VibrationEffect.createOneShot(Math.max(1, Math.min(ms, 200)), VibrationEffect.DEFAULT_AMPLITUDE));
        }

        @JavascriptInterface
        public void openUrl(String url) {
            ui.post(() -> openExternal(url));
        }

        @JavascriptInterface
        public void shareText(String title, String text) {
            ui.post(() -> {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_SUBJECT, title);
                send.putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(send, title));
            });
        }

        @JavascriptInterface
        public void saveFile(String name, String mime, String base64) {
            ui.post(() -> {
                pendingSave = Base64.decode(base64, Base64.DEFAULT);
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                i.putExtra(Intent.EXTRA_TITLE, name);
                try {
                    startActivityForResult(i, REQ_SAVE);
                } catch (ActivityNotFoundException e) {
                    Toast.makeText(MainActivity.this, "No file manager available", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void openFile(String accept) {
            ui.post(() -> {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try {
                    startActivityForResult(i, REQ_OPEN);
                } catch (ActivityNotFoundException e) {
                    Toast.makeText(MainActivity.this, "No file manager available", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void setImmersive(boolean on) {
            ui.post(() -> applyImmersive(on));
        }

        /** "landscape", "portrait" or anything else for the phone's own rotation. */
        @JavascriptInterface
        public void setOrientation(String mode) {
            ui.post(() -> setRequestedOrientation("landscape".equals(mode) ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                    : "portrait".equals(mode) ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
                    : ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED));
        }

        @JavascriptInterface
        public void keepScreenOn(boolean on) {
            ui.post(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }
    }
}
