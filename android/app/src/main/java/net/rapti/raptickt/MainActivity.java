package net.rapti.raptickt;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.ActivityManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Insets;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
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
    private static final int REQ_CAMERA = 43;
    private static final int REQ_IMAGE = 44;
    private static final String START_URL = "file:///android_asset/www/index.html";
    /** long side of a picture handed to the page, unless the page asks for another size */
    private static final int IMAGE_MAX = 2600;
    private volatile int imageMax = IMAGE_MAX;
    /** the blue of the splash screen: what the window shows until the page has drawn its own */
    private static final int BG = Color.parseColor("#1D4BFF");
    private int statusColor = BG, navColor = BG, topInset;
    private boolean lightBars;

    private WebView web;
    private FrameLayout root;
    private String lastCut = "";
    private byte[] pendingSave;
    private String pendingOpenName;
    private String pendingOpenText;
    private boolean pageReady;
    private boolean immersive;
    /** when the page's process last had to be started again, and how often in a row (see onRenderProcessGone) */
    private long lastRestart;
    private int restarts;
    private final Handler ui = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);

        root = new FrameLayout(this);
        root.setBackground(new BarsBackground());
        createWebView();
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
            if (topInset != t) { topInset = t; v.invalidate(); }
            return insets;
        });

        // restoreState gives nothing back when the saved state is missing or too old (after the app was
        // killed in the background): load the page then, instead of leaving an empty screen
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(START_URL);
        }
        // a file shared into the app is opened once: not again when the activity is re-created
        if (savedInstanceState == null) handleIntent(getIntent());
    }

    /** The WebView that shows the simulator, with its settings and the bridge, added to the window. */
    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void createWebView() {
        web = new WebView(this);
        web.setBackgroundColor(BG);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        root.addView(web, 0, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        // the page and everything it loads come from the app's assets (always readable); nothing
        // in it may read other files of the phone
        s.setAllowFileAccess(false);
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
                if (view != web) return;
                pageReady = true;
                lastCut = "";
                root.requestApplyInsets();
                ui.postDelayed(MainActivity.this::deliverPendingOpen, 600);
            }

            /**
             * The page's process is gone: Android took its memory back while the app was in the
             * background, or it crashed. Left unhandled this closes the whole app, so the page is
             * started again instead. Circuits are autosaved as they are edited, so nothing is
             * lost: "Continue where you left off" on the home screen brings the work back.
             */
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (view != web) return true; // an earlier WebView, already replaced
                long now = android.os.SystemClock.uptimeMillis();
                restarts = now - lastRestart < 20000 ? restarts + 1 : 1;
                lastRestart = now;
                if (restarts > 3) return false; // it dies again and again: give up rather than loop
                restartPage(detail.didCrash());
                return true;
            }
        });
    }

    /** Throw the page away and load it afresh in a new WebView (its old process is gone). */
    private void restartPage(boolean crashed) {
        WebView old = web;
        pageReady = false;
        lastCut = "";
        root.removeView(old);
        try {
            old.removeJavascriptInterface("RaptiAndroid");
            old.destroy();
        } catch (Exception ignored) {
            // it is gone either way
        }
        // what the old page had asked of the window is over: the new one starts from the splash
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (immersive) applyImmersive(false);
        applyBars(BG, BG, false);
        createWebView();
        web.loadUrl(START_URL);
        if (crashed) Toast.makeText(this, "RaptiCKT restarted after an error. Your circuit was autosaved.", Toast.LENGTH_LONG).show();
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

    /**
     * The phone is short of memory, or the app has been put away among the background apps: the
     * page lets go of everything it can make again (icons, preview pictures, drawing caches).
     */
    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        boolean low = level >= TRIM_MEMORY_RUNNING_LOW && level < TRIM_MEMORY_UI_HIDDEN;
        if (web != null && pageReady && (low || level >= TRIM_MEMORY_BACKGROUND)) {
            web.evaluateJavascript("window.raptiTrim && window.raptiTrim()", null);
        }
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

    /**
     * What shows behind the system bars. Android 15 draws the app edge to edge and ignores the bar
     * colours, so the strip under the status bar is painted here in the colour of the page's top bar,
     * and the rest in the page's background.
     */
    private final class BarsBackground extends android.graphics.drawable.Drawable {
        private final android.graphics.Paint paint = new android.graphics.Paint();
        @Override public void draw(android.graphics.Canvas c) {
            c.drawColor(navColor);
            paint.setColor(statusColor);
            c.drawRect(0, 0, getBounds().width(), topInset, paint);
        }
        @Override public void setAlpha(int alpha) { }
        @Override public void setColorFilter(android.graphics.ColorFilter f) { }
        @Override public int getOpacity() { return android.graphics.PixelFormat.OPAQUE; }
    }

    /** Colours the system bars to match the page; light = a bright theme, so the bar icons turn dark. */
    @SuppressWarnings("deprecation")
    private void applyBars(int status, int nav, boolean light) {
        statusColor = status; navColor = nav; lightBars = light;
        Window w = getWindow();
        w.setStatusBarColor(status);
        w.setNavigationBarColor(nav);
        root.invalidate();
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = w.getInsetsController();
            int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            if (c != null) c.setSystemBarsAppearance(light ? mask : 0, mask);
        } else if (!immersive) {
            w.getDecorView().setSystemUiVisibility(legacyBarFlags());
        }
    }

    @SuppressWarnings("deprecation")
    private int legacyBarFlags() {
        return lightBars ? View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : View.SYSTEM_UI_FLAG_VISIBLE;
    }

    /** Full screen: hide the status and navigation bars (a swipe from the edge shows them briefly). */
    @SuppressWarnings("deprecation")
    private void applyImmersive(boolean on) {
        immersive = on;
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = w.getAttributes();
            int mode = on ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                    : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;
            // setAttributes re-lays the whole window out (a visible flash): only when it really changes,
            // not again on every focus change while the app stays in full screen
            if (lp.layoutInDisplayCutoutMode != mode) {
                lp.layoutInDisplayCutoutMode = mode;
                w.setAttributes(lp);
            }
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
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY : legacyBarFlags());
        }
        if (root != null) root.requestApplyInsets(); // re-pad in this same frame: edge to edge in full screen
    }

    @Override
    protected void onDestroy() {
        ui.removeCallbacksAndMessages(null);
        if (web != null) {
            root.removeView(web); // a WebView must be out of the window before it is destroyed
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
        Uri found = null;
        try {
            if (Intent.ACTION_VIEW.equals(intent.getAction())) found = intent.getData();
            else if (Intent.ACTION_SEND.equals(intent.getAction())) {
                Object o = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                if (o instanceof Uri) found = (Uri) o;
            }
        } catch (Exception e) {
            found = null; // an intent that cannot be read is not a file to open
        }
        if (found == null) return;
        final Uri uri = found;
        // not on the main thread: a file kept on Drive or another cloud is downloaded as it is
        // read, and the app must not freeze (or be closed as "not responding") meanwhile
        new Thread(() -> {
            try {
                final String text = new String(readAll(uri), "UTF-8");
                final String name = displayName(uri);
                ui.post(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    pendingOpenText = text;
                    pendingOpenName = name;
                    if (pageReady) deliverPendingOpen();
                });
            } catch (Exception e) {
                ui.post(() -> {
                    if (!isFinishing() && !isDestroyed()) Toast.makeText(this, "Could not open file", Toast.LENGTH_SHORT).show();
                });
            }
        }, "rapti-open").start();
    }

    /** Run a script in the page, unless the activity (and its WebView) is already gone. */
    private void js(String script) {
        if (web == null || isFinishing() || isDestroyed()) return;
        web.evaluateJavascript(script, null);
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
                final Uri uri = data.getData();
                new Thread(() -> { // (off the main thread, as in handleIntent)
                    try {
                        final String b64 = Base64.encodeToString(readAll(uri), Base64.NO_WRAP);
                        final String name = JSONObject.quote(displayName(uri));
                        ui.post(() -> js("window.__raptiFileOpened && window.__raptiFileOpened(" + name + ",'" + b64 + "')"));
                    } catch (Exception e) {
                        final String msg = JSONObject.quote(String.valueOf(e.getMessage()));
                        ui.post(() -> js("window.__raptiFileError && window.__raptiFileError(" + msg + ")"));
                    }
                }, "rapti-open").start();
            } else {
                js("window.__raptiFileError && window.__raptiFileError('cancelled')");
            }
        } else if (requestCode == REQ_CAMERA || requestCode == REQ_IMAGE) {
            Uri uri = requestCode == REQ_IMAGE && data != null ? data.getData() : null;
            if (resultCode != RESULT_OK || (requestCode == REQ_IMAGE && uri == null)) {
                imageError("cancelled");
                return;
            }
            new Thread(() -> {
                try {
                    byte[] raw = requestCode == REQ_CAMERA ? readFile(PhotoProvider.file(this)) : readAll(uri);
                    String b64 = Base64.encodeToString(shrinkImage(raw), Base64.NO_WRAP);
                    ui.post(() -> js("window.__raptiImage && window.__raptiImage('" + b64 + "')"));
                } catch (Exception e) {
                    imageError("Could not read the picture (" + e.getMessage() + ")");
                } finally {
                    if (requestCode == REQ_CAMERA) PhotoProvider.file(this).delete();
                }
            }, "rapti-image").start();
        }
    }

    // ------------------------------------------------------------ pictures
    private void imageError(String msg) {
        ui.post(() -> js("window.__raptiImageError && window.__raptiImageError(" + JSONObject.quote(msg) + ")"));
    }

    private byte[] readFile(File f) throws Exception {
        if (!f.exists() || f.length() == 0) throw new Exception("no photo was taken");
        try (InputStream in = new FileInputStream(f); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[65536];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }

    /** Any picture → upright JPEG on white, long side at most imageMax px. */
    private byte[] shrinkImage(byte[] raw) throws Exception {
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(raw, 0, raw.length, o);
        if (o.outWidth <= 0 || o.outHeight <= 0) throw new Exception("not a picture");
        int sample = 1;
        final int max = imageMax;
        while (Math.max(o.outWidth, o.outHeight) / (sample * 2) >= max) sample *= 2;
        o = new BitmapFactory.Options();
        o.inSampleSize = sample;
        Bitmap src = BitmapFactory.decodeByteArray(raw, 0, raw.length, o);
        if (src == null) throw new Exception("not a picture");
        int deg = 0;
        try {
            int t = new ExifInterface(new ByteArrayInputStream(raw)).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            deg = t == ExifInterface.ORIENTATION_ROTATE_90 ? 90 : t == ExifInterface.ORIENTATION_ROTATE_180 ? 180 : t == ExifInterface.ORIENTATION_ROTATE_270 ? 270 : 0;
        } catch (Exception ignored) {
            // no EXIF (a PNG, a screenshot): as decoded
        }
        int sw = src.getWidth(), sh = src.getHeight();
        float k = Math.min(1f, (float) max / Math.max(sw, sh));
        int w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
        boolean side = deg == 90 || deg == 270;
        Bitmap out = Bitmap.createBitmap(side ? h : w, side ? w : h, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(out);
        c.drawColor(Color.WHITE); // transparent PNGs read as white paper
        Matrix m = new Matrix();
        m.postScale(k, k);
        m.postRotate(deg);
        if (deg == 90) m.postTranslate(h, 0);
        else if (deg == 180) m.postTranslate(w, h);
        else if (deg == 270) m.postTranslate(0, w);
        c.drawBitmap(src, m, new Paint(Paint.FILTER_BITMAP_FLAG));
        src.recycle();
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        out.compress(Bitmap.CompressFormat.JPEG, 85, bytes);
        out.recycle();
        return bytes.toByteArray();
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
                try {
                    startActivity(Intent.createChooser(send, title));
                } catch (Exception e) {
                    // no app to share with, or a circuit too big to hand over as text
                    Toast.makeText(MainActivity.this, "Could not share this circuit. Use Export file instead.", Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void saveFile(String name, String mime, String base64) {
            ui.post(() -> {
                try {
                    pendingSave = Base64.decode(base64, Base64.DEFAULT);
                } catch (IllegalArgumentException e) {
                    Toast.makeText(MainActivity.this, "Save failed", Toast.LENGTH_SHORT).show();
                    return;
                }
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

        /**
         * A picture for "Circuit from photo": the camera, or one chosen from the gallery, handed
         * back with its long side at most max px.
         */
        @JavascriptInterface
        public void pickImage(boolean camera, int max) {
            imageMax = Math.max(400, Math.min(4096, max));
            ui.post(() -> {
                try {
                    if (camera) {
                        PhotoProvider.file(MainActivity.this).delete();
                        Uri out = PhotoProvider.uri(MainActivity.this);
                        Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        i.putExtra(MediaStore.EXTRA_OUTPUT, out);
                        i.setClipData(ClipData.newRawUri("", out));
                        i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivityForResult(i, REQ_CAMERA);
                    } else {
                        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                        i.addCategory(Intent.CATEGORY_OPENABLE);
                        i.setType("image/*");
                        startActivityForResult(i, REQ_IMAGE);
                    }
                } catch (ActivityNotFoundException e) {
                    imageError(camera ? "No camera app found" : "No gallery app found");
                } catch (Exception e) {
                    imageError(String.valueOf(e.getMessage()));
                }
            });
        }

        /** The page's colours for the status bar and the navigation bar ("#rrggbb"), and whether the theme is a bright one. */
        @JavascriptInterface
        public void setBars(String status, String nav, boolean light) {
            final int s, n;
            try { s = Color.parseColor(status); n = Color.parseColor(nav); } catch (Exception e) { return; }
            ui.post(() -> applyBars(s, n, light));
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
