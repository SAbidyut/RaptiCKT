// RaptiCKT user manual: the text (English + বাংলা) and the builders that turn it,
// together with the live component library and example list, into the in-app
// manual screen and into docs/MANUAL.md. No DOM here, so it also runs in Node.
//
// Block types: p (paragraph), h (sub-heading), steps (numbered), ul (bullets),
// tip, warn, table. `**bold**` and `code` are the only inline markup.

import { CATEGORIES, getType } from '../elements/index.js';
import { EXAMPLES } from './examples.js';
import { APP, RAPTI } from './brand.js';

const P = (en, bn) => ({ t: 'p', en, bn });
const H = (en, bn) => ({ t: 'h', en, bn });
const S = (en, bn) => ({ t: 'steps', en, bn });
const L = (en, bn) => ({ t: 'ul', en, bn });
const TIP = (en, bn) => ({ t: 'tip', en, bn });
const WARN = (en, bn) => ({ t: 'warn', en, bn });
// rows: [[left, right], …] where each cell is [en, bn]; head is [[en, bn], [en, bn]]
const T = (head, rows) => ({ t: 'table', head, rows });

export const LANGS = [['en', 'English'], ['bn', 'বাংলা']];

export const UI_TEXT = {
  title: { en: 'User Manual', bn: 'ইউজার ম্যানুয়াল' },
  search: { en: 'Search the manual…', bn: 'ম্যানুয়ালে খুঁজুন…' },
  contents: { en: 'Contents', bn: 'সূচিপত্র' },
  noResult: { en: 'Nothing found. Try another word.', bn: 'কিছু পাওয়া যায়নি। অন্য শব্দ দিয়ে চেষ্টা করুন।' },
  open: { en: 'Open', bn: 'খুলুন' },
  tryIt: { en: 'Open this example', bn: 'এই উদাহরণ খুলুন' },
  props: { en: 'Settings', bn: 'সেটিংস' },
  note: {
    en: 'Component descriptions are shown in English, exactly as they appear inside the app.',
    bn: 'কম্পোনেন্টের বর্ণনা অ্যাপের ভেতরে যেমন আছে, তেমনই ইংরেজিতে দেওয়া হলো।',
  },
  parts: { en: 'components', bn: 'টি কম্পোনেন্ট' },
  examplesCount: { en: 'examples', bn: 'টি উদাহরণ' },
  prev: { en: 'Previous', bn: 'আগের' },
  next: { en: 'Next', bn: 'পরের' },
  version: { en: 'Version', bn: 'ভার্সন' },
  tagline: {
    en: 'Everything in the app, explained step by step.',
    bn: 'অ্যাপের সবকিছু ধাপে ধাপে সহজ ভাষায়।',
  },
};

// ------------------------------------------------------------------------ chapters
export const CHAPTERS = [
  // ------------------------------------------------------------------ 1
  {
    id: 'welcome', icon: 'bolt',
    title: { en: 'Welcome to RaptiCKT', bn: 'RaptiCKT-তে স্বাগতম' },
    blocks: [
      P('**RaptiCKT** is a circuit simulator that runs on your phone. You draw a circuit, press **Run**, and the app calculates what every wire and part is doing, live: voltages glow on the wires, small dots show current flowing, and you can measure with an oscilloscope and a multimeter. Nothing needs an internet connection.',
        '**RaptiCKT** একটি সার্কিট সিমুলেটর যা আপনার ফোনেই চলে। আপনি সার্কিট আঁকেন, **Run** চাপেন, আর অ্যাপ লাইভ হিসাব করে দেখায় প্রতিটি তার ও যন্ত্রাংশ কী করছে: তারে ভোল্টেজের রং জ্বলে, ছোট ডট দিয়ে কারেন্টের প্রবাহ দেখা যায়, আর অসিলোস্কোপ ও মাল্টিমিটার দিয়ে মাপাও যায়। ইন্টারনেট লাগে না।'),
      H('What you can do with it', 'এই অ্যাপ দিয়ে কী কী করা যায়'),
      L([
        'Build analog, digital and mixed circuits on an unlimited canvas.',
        'Pick from **335 components in 20 categories**: sources, batteries, resistors, capacitors, transformers, protection devices, switches, house-wiring parts, motors, diodes, transistors, op-amps, logic ICs, sensors, meters and more.',
        'Watch the circuit work: green wires are positive, red wires are negative, yellow dots move with the current.',
        'Tap switches and push buttons while the circuit is running, and turn a knob to change any value live.',
        'Measure with a **6-channel oscilloscope** (with FFT and XY) and a **multimeter** (V, A, Ω, W).',
        'Run **AC sweep (Bode plot)**, **DC sweep**, **Operating point** and export a **SPICE netlist**.',
        'Learn from **29 ready-made examples**: LED, RC filter, rectifier, amplifier, 555 timer, tube light, staircase wiring, house wiring, DOL motor starter and more.',
        'Save circuits on the phone, share them as `.rckt` files, and export a picture (PNG).',
      ], [
        'অসীম আকারের ক্যানভাসে অ্যানালগ, ডিজিটাল ও মিক্সড সার্কিট বানান।',
        '২০টি ক্যাটাগরির **৩৩৫টি কম্পোনেন্ট** থেকে বেছে নিন: সোর্স, ব্যাটারি, রেজিস্টর, ক্যাপাসিটর, ট্রান্সফরমার, প্রটেকশন ডিভাইস, সুইচ, হাউস-ওয়্যারিং-এর যন্ত্রাংশ, মোটর, ডায়োড, ট্রানজিস্টর, অপ-অ্যাম্প, লজিক আইসি, সেন্সর, মিটার ইত্যাদি।',
        'সার্কিট চলা দেখুন: সবুজ তার মানে পজিটিভ, লাল তার মানে নেগেটিভ, হলুদ ডট কারেন্টের সাথে চলে।',
        'সার্কিট চলার সময় সুইচ ও পুশ বাটন চাপুন, আর নব ঘুরিয়ে যেকোনো মান সাথে সাথে বদলান।',
        '**৬-চ্যানেল অসিলোস্কোপ** (FFT ও XY সহ) এবং **মাল্টিমিটার** (V, A, Ω, W) দিয়ে মাপুন।',
        '**AC sweep (Bode plot)**, **DC sweep**, **Operating point** চালান এবং **SPICE netlist** এক্সপোর্ট করুন।',
        '**২৯টি তৈরি উদাহরণ** থেকে শিখুন: LED, RC ফিল্টার, রেকটিফায়ার, অ্যামপ্লিফায়ার, 555 টাইমার, টিউবলাইট, সিঁড়ির ওয়্যারিং, হাউস ওয়্যারিং, DOL মোটর স্টার্টার ইত্যাদি।',
        'সার্কিট ফোনে সেভ করুন, `.rckt` ফাইল হিসেবে শেয়ার করুন, আর ছবি (PNG) এক্সপোর্ট করুন।',
      ]),
      H('Who it is for', 'কাদের জন্য'),
      P('Electrical and electronic engineering students, teachers, technicians, hobbyists and researchers. It is made by **RAPTI — Resonance Automation Professional Training Institute**.',
        'ইলেকট্রিক্যাল ও ইলেকট্রনিক ইঞ্জিনিয়ারিং-এর শিক্ষার্থী, শিক্ষক, টেকনিশিয়ান, হবিস্ট ও গবেষকদের জন্য। তৈরি করেছে **RAPTI — Resonance Automation Professional Training Institute**।'),
      H('Requirements', 'যা লাগবে'),
      L(['Android 8.0 or newer.', 'No internet needed. Everything, including your saved circuits, stays on your phone.'],
        ['Android 8.0 বা নতুন।', 'ইন্টারনেট লাগে না। সবকিছু, আপনার সেভ করা সার্কিটসহ, ফোনেই থাকে।']),
      H('How to read this manual', 'এই ম্যানুয়াল কীভাবে পড়বেন'),
      P('If you are new, read chapters 2 to 6 first (about 10 minutes). The rest is a reference: come back when you need a feature. Use the search box at the top, or tap a chapter in the contents. The **English / বাংলা** button switches the language.',
        'নতুন হলে আগে ২ থেকে ৬ নম্বর অধ্যায় পড়ুন (প্রায় ১০ মিনিট)। বাকিটা রেফারেন্স: যখন যে ফিচার লাগবে তখন দেখে নিন। উপরের সার্চ বক্সে খুঁজুন, অথবা সূচিপত্র থেকে অধ্যায়ে যান। **English / বাংলা** বাটনে ভাষা বদলায়।'),
    ],
  },

  // ------------------------------------------------------------------ 2
  {
    id: 'quickstart', icon: 'play',
    title: { en: 'Quick start: your first circuit', bn: 'দ্রুত শুরু: প্রথম সার্কিট' },
    blocks: [
      P('Let us build the "hello world" of electronics: a battery, a resistor and an LED. It takes about two minutes.',
        'চলুন ইলেকট্রনিক্সের "hello world" বানাই: একটি ব্যাটারি, একটি রেজিস্টর আর একটি LED। সময় লাগবে প্রায় দুই মিনিট।'),
      S([
        'On the **Home** screen tap **New circuit**. An empty board opens.',
        'Tap the round **+** button (bottom right). The component menu opens.',
        'Type `dc` in the search box and tap **DC Voltage**. A battery symbol appears on the board. Then search `resistor` and tap **Resistor**, then search `led` and tap **LED**, then search `ground` and tap **Ground**. The menu stays open so you can add several parts in a row. Tap **✕** to close it.',
        'Drag the parts with your finger to arrange them in a row. Pinch with two fingers to zoom, drag on empty space to move the board.',
        '**Draw the wires.** Every part has small circles at its ends: these are the **terminals**. Tap one terminal, then tap a terminal of the next part: the wire is drawn and routed for you. Connect: battery **+** → resistor → LED anode (the flat-triangle side) → LED cathode → ground, and battery **−** → ground.',
        'Tap the battery and use the **knob** that appears (or open its properties) to set the voltage to **9 V**. Tap the resistor and set it to **470 Ω**. You can type values like `470`, `4.7k`, `10u`.',
        'Press **Run** in the toolbar. The wires turn green, yellow dots flow, and the LED lights up. The current (about 15 mA) is written next to the resistor.',
        'Select the wire between the resistor and the LED and tap **Scope**. The oscilloscope opens and draws that voltage.',
        'Press **Run** again to pause. Tap **Undo** if you made a mistake. The circuit is saved automatically; find it later under **My Circuits**.',
      ], [
        '**Home** স্ক্রিনে **New circuit** চাপুন। একটি খালি বোর্ড খুলবে।',
        'নিচে ডানদিকের গোল **+** বাটন চাপুন। কম্পোনেন্ট মেনু খুলবে।',
        'সার্চ বক্সে `dc` লিখে **DC Voltage** চাপুন। বোর্ডে ব্যাটারির চিহ্ন আসবে। এরপর `resistor` সার্চ করে **Resistor**, `led` সার্চ করে **LED**, `ground` সার্চ করে **Ground** চাপুন। মেনু খোলা থাকে, তাই একটানা কয়েকটি পার্ট যোগ করা যায়। শেষে **✕** চেপে বন্ধ করুন।',
        'আঙুল দিয়ে পার্টগুলো টেনে এক লাইনে সাজান। দুই আঙুলে চিমটি কেটে জুম করুন, ফাঁকা জায়গায় টেনে বোর্ড সরান।',
        '**তার আঁকুন।** প্রতিটি পার্টের মাথায় ছোট গোল চিহ্ন আছে: এগুলো **টার্মিনাল**। একটি টার্মিনালে ট্যাপ করুন, তারপর পরের পার্টের টার্মিনালে ট্যাপ করুন: তার নিজে থেকেই সুন্দরভাবে আঁকা হয়ে যাবে। সংযোগ: ব্যাটারি **+** → রেজিস্টর → LED অ্যানোড (ত্রিভুজের সমতল দিক) → LED ক্যাথোড → গ্রাউন্ড, আর ব্যাটারি **−** → গ্রাউন্ড।',
        'ব্যাটারিতে ট্যাপ করুন, যে **নব** আসবে সেটা দিয়ে (বা প্রপার্টিজ খুলে) ভোল্টেজ **9 V** করুন। রেজিস্টরে ট্যাপ করে **470 Ω** দিন। মান টাইপ করা যায়: `470`, `4.7k`, `10u` ইত্যাদি।',
        'টুলবারে **Run** চাপুন। তার সবুজ হবে, হলুদ ডট বইবে, আর LED জ্বলবে। কারেন্ট (প্রায় 15 mA) রেজিস্টরের পাশে লেখা থাকবে।',
        'রেজিস্টর ও LED-এর মাঝের তারে ট্যাপ করে **Scope** চাপুন। অসিলোস্কোপ খুলে ওই ভোল্টেজ আঁকবে।',
        'থামাতে আবার **Run** (Pause) চাপুন। ভুল হলে **Undo** চাপুন। সার্কিট নিজে নিজেই সেভ হয়; পরে **My Circuits**-এ পাবেন।',
      ]),
      TIP('Even faster: open **Home → Examples → LED with switch**. It is already wired. Press Run and tap the switch.',
        'আরও সহজ: **Home → Examples → LED with switch** খুলুন। ওয়্যারিং করাই আছে। Run চাপুন আর সুইচে ট্যাপ করুন।'),
      TIP('If the LED does not light, check that every wire end really touches a terminal, and that there is a resistor in series. See **Troubleshooting**.',
        'LED না জ্বললে দেখুন প্রতিটি তারের মাথা সত্যিই টার্মিনাল ছুঁয়ে আছে কিনা, আর সিরিজে রেজিস্টর আছে কিনা। **Troubleshooting** অধ্যায় দেখুন।'),
    ],
  },

  // ------------------------------------------------------------------ 3
  {
    id: 'screens', icon: 'home',
    title: { en: 'Home, Examples, My Circuits, About', bn: 'Home, Examples, My Circuits, About' },
    blocks: [
      P('When the app opens you see a short splash, then the **Home** screen. The bar at the bottom switches between the main pages.',
        'অ্যাপ খুললে একটু স্প্ল্যাশ দেখাবে, তারপর **Home** স্ক্রিন। নিচের বার দিয়ে মূল পেজগুলোতে যাওয়া যায়।'),
      H('Home', 'Home'),
      L([
        '**New circuit**: opens an empty board.',
        '**Open file**: opens a `.rckt` circuit file or a backup file from your phone.',
        '**Continue where you left off**: appears when there is an unfinished circuit. One tap returns to it.',
        'Feature tiles (Oscilloscope, Multimeter, Bode plots, DC sweep, SPICE export) open a new board; **Sensors** opens the Examples page.',
        '**Recent circuits** and **Start with an example**: tap a card to open it.',
        'Tap the **RAPTI logo** (top left) or the RAPTI banner to read about the institute.',
        'The **sliders** icon (top right) opens **Settings**.',
      ], [
        '**New circuit**: খালি বোর্ড খোলে।',
        '**Open file**: ফোন থেকে `.rckt` সার্কিট ফাইল বা ব্যাকআপ ফাইল খোলে।',
        '**Continue where you left off**: অসমাপ্ত সার্কিট থাকলে দেখা যায়। এক ট্যাপে ফিরে যাওয়া যায়।',
        'ফিচার টাইল (Oscilloscope, Multimeter, Bode plots, DC sweep, SPICE export) নতুন বোর্ড খোলে; **Sensors** টাইল Examples পেজ খোলে।',
        '**Recent circuits** ও **Start with an example**: কার্ডে ট্যাপ করলেই খোলে।',
        'বাঁ-উপরের **RAPTI লোগো** বা RAPTI ব্যানারে ট্যাপ করলে ইনস্টিটিউট সম্পর্কে জানা যায়।',
        'ডান-উপরের **স্লাইডার** আইকন **Settings** খোলে।',
      ]),
      H('Examples', 'Examples'),
      P('29 ready-made circuits, each with an explanation. Filter by category with the chips at the top. Opening an example starts it running by itself (press Pause to stop it). If you change an example, it is saved as your own circuit when you go back; the original example is never damaged.',
        '২৯টি তৈরি সার্কিট, প্রতিটির ব্যাখ্যাসহ। উপরের চিপ দিয়ে ক্যাটাগরি অনুযায়ী ছাঁটাই করুন। উদাহরণ খুললে সেটা নিজে থেকেই চলতে শুরু করে (থামাতে Pause চাপুন)। উদাহরণে কিছু বদলালে ফিরে যাওয়ার সময় সেটা আপনার নিজের সার্কিট হিসেবে সেভ হয়; মূল উদাহরণ কখনও নষ্ট হয় না।'),
      P('The full list is in the chapter **Examples**.', 'পূর্ণ তালিকা **Examples** অধ্যায়ে আছে।'),
      H('My Circuits', 'My Circuits'),
      P('Your saved **projects** (circuits), kept on this phone and sorted into **folders** like files on a computer. Tap a project to open it; tap a folder to go inside. The path at the top (**My Circuits › Folder › Sub-folder**) shows where you are: tap any name in it to jump up. The Android **Back** button also goes up one folder.',
        'আপনার সেভ করা **প্রজেক্ট** (সার্কিট), ফোনেই থাকে এবং কম্পিউটারের ফাইলের মতো **ফোল্ডারে** সাজানো যায়। প্রজেক্টে ট্যাপ করলে খোলে; ফোল্ডারে ট্যাপ করলে ভেতরে ঢোকে। উপরের পথ (**My Circuits › ফোল্ডার › সাব-ফোল্ডার**) দেখায় আপনি কোথায় আছেন: যেকোনো নামে ট্যাপ করলে সেখানে উঠে যায়। Android-এর **Back** বাটনও এক ফোল্ডার উপরে যায়।'),
      L([
        '**New project**: asks for a name, then opens an empty board. The project is saved **in the folder you are viewing**.',
        '**New folder**: makes a folder here. Folders can hold projects and other folders, as deep as you like.',
        '**Import**: opens a `.rckt` file or a backup; it is added to the folder you are viewing.',
        '**Backup all**: one file with every project **and your folders**. Restoring it brings the folders back too.',
        '**Select**: see below.',
      ], [
        '**New project**: নাম জিজ্ঞেস করে, তারপর খালি বোর্ড খোলে। প্রজেক্ট **যে ফোল্ডার দেখছেন তাতেই** সেভ হয়।',
        '**New folder**: এখানে একটি ফোল্ডার বানায়। ফোল্ডারে প্রজেক্ট ও অন্য ফোল্ডার রাখা যায়, যত গভীরে খুশি।',
        '**Import**: `.rckt` ফাইল বা ব্যাকআপ খোলে; যে ফোল্ডার দেখছেন সেখানে যোগ হয়।',
        '**Backup all**: সব প্রজেক্ট **ও আপনার ফোল্ডারসহ** এক ফাইল। রিস্টোর করলে ফোল্ডারও ফিরে আসে।',
        '**Select**: নিচে দেখুন।',
      ]),
      P('Tap the **⋮** button on a project for **Open**, **Rename**, **Move to folder…**, **Duplicate**, **Export file**, **Share** and **Delete**. On a folder it offers **Open**, **Rename**, **Move to…** and **Delete folder**.',
        'প্রজেক্টের **⋮** বাটনে পাবেন **Open**, **Rename**, **Move to folder…**, **Duplicate**, **Export file**, **Share** ও **Delete**। ফোল্ডারে পাবেন **Open**, **Rename**, **Move to…** ও **Delete folder**।'),
      H('Select, move and delete many at once', 'একসাথে অনেক সিলেক্ট, সরানো ও মুছা'),
      S([
        'Tap **Select**. Round tick boxes appear.',
        'Tap projects and folders to tick them. **All** ticks everything in the current folder (it then reads **None**).',
        '**Move**: choose the destination (**My Circuits** at the top, or any folder, or **New folder…**). A folder cannot be moved into itself.',
        '**Delete**: asks first and shows how many projects and folders will go, including projects inside the folders you picked. **Backup all first** lets you save everything before deleting.',
        'Tap **✕** (or Back) to leave Select mode.',
      ], [
        '**Select** চাপুন। গোল টিক বক্স আসবে।',
        'প্রজেক্ট ও ফোল্ডারে ট্যাপ করে টিক দিন। **All** বর্তমান ফোল্ডারের সবকিছুতে টিক দেয় (তখন লেখা আসে **None**)।',
        '**Move**: গন্তব্য বাছুন (উপরের **My Circuits**, যেকোনো ফোল্ডার, বা **New folder…**)। ফোল্ডারকে নিজের ভেতরে সরানো যায় না।',
        '**Delete**: আগে জিজ্ঞেস করে এবং কয়টি প্রজেক্ট ও ফোল্ডার যাবে তা দেখায়, বাছা ফোল্ডারের ভেতরের প্রজেক্টসহ। **Backup all first** চেপে মুছার আগে সব সেভ করে নিতে পারেন।',
        'Select মোড থেকে বের হতে **✕** (বা Back) চাপুন।',
      ]),
      WARN('Deleting a folder also deletes every project inside it.',
        'ফোল্ডার মুছলে তার ভেতরের সব প্রজেক্টও মুছে যায়।'),
      H('About', 'About'),
      P('Version number, a short description of the app and its engine, information about RAPTI (courses, phone, WhatsApp, email, website, address), and accuracy notes.',
        'ভার্সন নম্বর, অ্যাপ ও তার ইঞ্জিনের সংক্ষিপ্ত বিবরণ, RAPTI সম্পর্কে তথ্য (কোর্স, ফোন, WhatsApp, ইমেইল, ওয়েবসাইট, ঠিকানা) এবং নির্ভুলতা সংক্রান্ত নোট।'),
      H('Back button', 'Back বাটন'),
      P('The Android **Back** button closes the topmost thing: an open dialog, then Settings or Manual, then panels inside the editor, then clears the selection, and finally goes back to Home. Your circuit is saved when you leave the editor or put the app in the background.',
        'Android-এর **Back** বাটন সবচেয়ে উপরের জিনিসটি বন্ধ করে: খোলা ডায়ালগ, তারপর Settings বা Manual, তারপর এডিটরের প্যানেল, তারপর সিলেকশন বাতিল, সবশেষে Home-এ ফেরা। এডিটর থেকে বের হলে বা অ্যাপ ব্যাকগ্রাউন্ডে গেলে সার্কিট সেভ হয়ে যায়।'),
    ],
  },

  // ------------------------------------------------------------------ 4
  {
    id: 'editor', icon: 'sliders',
    title: { en: 'The editor at a glance', bn: 'এডিটর এক নজরে' },
    blocks: [
      P('The editor is where you build and run circuits. From top to bottom:',
        'এডিটরে সার্কিট বানানো ও চালানো হয়। উপর থেকে নিচে:'),
      H('Top bar', 'টপ বার'),
      T([['Button', 'বাটন'], ['What it does', 'কী করে']], [
        [['Back arrow', 'Back তীর'], ['Saves and returns to Home.', 'সেভ করে Home-এ ফেরে।']],
        [['Circuit name', 'সার্কিটের নাম'], ['Tap to rename. The line below shows your note or the component count.', 'ট্যাপ করলে নাম বদলায়। নিচের লাইনে নোট বা কম্পোনেন্ট সংখ্যা দেখায়।']],
        [['Eye', 'চোখ'], ['Cycles the labels: values → names + values → hidden.', 'লেবেল ঘোরায়: মান → নাম + মান → লুকানো।']],
        [['Multimeter', 'মাল্টিমিটার'], ['Shows or hides the multimeter.', 'মাল্টিমিটার দেখায় বা লুকায়।']],
        [['Oscilloscope', 'অসিলোস্কোপ'], ['Shows or hides the scope panel.', 'স্কোপ প্যানেল দেখায় বা লুকায়।']],
        [['Analysis', 'অ্যানালাইসিস'], ['AC sweep, DC sweep, Operating point, SPICE netlist.', 'AC sweep, DC sweep, Operating point, SPICE netlist।']],
        [['⋮ More', '⋮ More'], ['Save, export, share, netlist, picture, settings, help, clear.', 'সেভ, এক্সপোর্ট, শেয়ার, নেটলিস্ট, ছবি, সেটিংস, হেল্প, ক্লিয়ার।']],
      ]),
      H('Toolbar', 'টুলবার'),
      T([['Button', 'বাটন'], ['What it does', 'কী করে']], [
        [['Run / Pause / Resume', 'Run / Pause / Resume'], ['Starts the simulation, pauses it, continues it.', 'সিমুলেশন চালু, বিরতি, আবার চালু করে।']],
        [['Restart', 'Restart'], ['Starts again from time zero (capacitors empty, etc.).', 'শূন্য সময় থেকে আবার শুরু করে (ক্যাপাসিটর খালি ইত্যাদি)।']],
        [['Step', 'Step'], ['Pauses and advances a small slice of time. Press repeatedly to go frame by frame.', 'থামিয়ে অল্প সময় এগিয়ে দেয়। বারবার চেপে ধাপে ধাপে দেখা যায়।']],
        [['Select', 'Select'], ['Turns on multi-select mode ({{ch:editing}}).', 'মাল্টি-সিলেক্ট মোড চালু করে ({{ch:editing}})।']],
        [['Undo / Redo', 'Undo / Redo'], ['Goes back or forward through your last 120 changes.', 'শেষ ১২০টি পরিবর্তনের মধ্যে পিছনে বা সামনে যায়।']],
        [['Fit', 'Fit'], ['Zooms so the whole circuit is visible.', 'পুরো সার্কিট দেখা যায় এমনভাবে জুম করে।']],
      ]),
      H('The board', 'বোর্ড'),
      L([
        'The big area with the grid is your **canvas**. It is unlimited: pan and zoom freely.',
        'The round **+** button (bottom right) adds a component.',
        'The chip at the top of the board shows the simulation time and speed, for example `t = 12.5 ms · 5 ms/s`. Tap it to change the speed ({{ch:running}}). It says **CPU-limited** when the phone cannot keep up.',
        'A red or yellow bar appears at the top when the circuit has a problem ({{ch:troubleshooting}}).',
        'When you select a part, a **quick bar** appears (name, current reading, rotate, scope, edit, delete) and, for parts with a main value, the **knob**.',
        'Messages (toasts) appear briefly at the bottom to confirm what happened.',
      ], [
        'গ্রিডওয়ালা বড় জায়গাটাই আপনার **ক্যানভাস**। এটা অসীম: ইচ্ছেমতো পান ও জুম করুন।',
        'ডান-নিচের গোল **+** বাটন কম্পোনেন্ট যোগ করে।',
        'বোর্ডের উপরের চিপে সিমুলেশনের সময় ও গতি দেখায়, যেমন `t = 12.5 ms · 5 ms/s`। ট্যাপ করলে গতি বদলানো যায় ({{ch:running}})। ফোন তাল মেলাতে না পারলে লেখা আসে **CPU-limited**।',
        'সার্কিটে সমস্যা থাকলে উপরে লাল বা হলুদ বার আসে ({{ch:troubleshooting}})।',
        'কোনো পার্ট সিলেক্ট করলে **কুইক বার** আসে (নাম, কারেন্ট রিডিং, ঘোরানো, স্কোপ, এডিট, ডিলিট), আর মূল মান আছে এমন পার্টে **নব** আসে।',
        'ছোট মেসেজ (টোস্ট) কিছুক্ষণের জন্য নিচে আসে, কী হলো জানাতে।',
      ]),
      H('Gestures', 'জেসচার'),
      T([['Gesture', 'জেসচার'], ['Result', 'ফল']], [
        [['Tap a part', 'পার্টে ট্যাপ'], ['Selects it. On a switch or button, it also operates it.', 'সিলেক্ট করে। সুইচ বা বাটনে হলে সেটা চালায়ও।']],
        [['Hold a part (half a second)', 'পার্টে আঙুল চেপে রাখা (আধা সেকেন্ড)'], ['Opens its properties.', 'প্রপার্টিজ খোলে।']],
        [['Drag a part', 'পার্ট টানা'], ['Moves it. Wires stay attached and follow.', 'সরায়। তার লেগে থাকে ও সাথে সাথে আসে।']],
        [['Tap a terminal, then another', 'একটি টার্মিনালে, তারপর আরেকটিতে ট্যাপ'], ['Draws a wire between them (EveryCircuit style).', 'দুটির মাঝে তার আঁকে (EveryCircuit-এর মতো)।']],
        [['Drag empty space', 'ফাঁকা জায়গায় টানা'], ['Pans the board.', 'বোর্ড সরায়।']],
        [['Pinch with two fingers', 'দুই আঙুলে চিমটি'], ['Zooms in and out.', 'জুম ইন/আউট।']],
        [['Hold empty space, then drag', 'ফাঁকা জায়গায় চেপে ধরে টানা'], ['Draws a selection box.', 'সিলেকশন বক্স আঁকে।']],
        [['Tap a wire', 'তারে ট্যাপ'], ['Selects the wire (then you can scope or delete it).', 'তার সিলেক্ট করে (তারপর স্কোপ বা ডিলিট করা যায়)।']],
        [['Tap empty space', 'ফাঁকা জায়গায় ট্যাপ'], ['Clears the selection.', 'সিলেকশন বাতিল করে।']],
      ]),
      P('On a computer browser you can also use: **Delete** (remove), **R** (rotate), **Space** (run/pause), **Ctrl+Z / Ctrl+Y** (undo/redo), **Ctrl+D** (copy), and the mouse wheel to zoom.',
        'কম্পিউটারের ব্রাউজারে আরও চলে: **Delete** (মুছুন), **R** (ঘোরান), **Space** (run/pause), **Ctrl+Z / Ctrl+Y** (undo/redo), **Ctrl+D** (কপি), আর মাউসের হুইলে জুম।'),
    ],
  },

  // ------------------------------------------------------------------ 5
  {
    id: 'adding', icon: 'plus',
    title: { en: 'Adding components', bn: 'কম্পোনেন্ট যোগ করা' },
    blocks: [
      S([
        'Tap the round **+** button. The component menu slides up.',
        'Choose a category tab: **Recent**, **Sources**, **Batteries**, **Passive**, **Transformers**, **Protection**, **Switches & Relays**, **Electrical**, **Power Systems**, **Machines**, **Diodes**, **Transistors**, **Thyristors & Power**, **Analog ICs**, **Control & Math**, **Logic Gates**, **Digital ICs**, **Sensors**, **Output**, **Vacuum Tubes**, **Meters**. Swipe the tab row sideways to see them all.',
        'Or type in the **search box**. It searches names, keywords and categories, for example `thermistor`, `555`, `3 phase`, `fuse`.',
        'Tap a component. It is placed in a free spot in the middle of the visible board. The menu stays open, so tap more parts if you need them.',
        'Tap **✕** (or the Back button) to close the menu.',
      ], [
        'গোল **+** বাটন চাপুন। কম্পোনেন্ট মেনু নিচ থেকে উঠে আসবে।',
        'একটি ক্যাটাগরি ট্যাব বেছে নিন: **Recent**, **Sources**, **Batteries**, **Passive**, **Transformers**, **Protection**, **Switches & Relays**, **Electrical**, **Power Systems**, **Machines**, **Diodes**, **Transistors**, **Thyristors & Power**, **Analog ICs**, **Control & Math**, **Logic Gates**, **Digital ICs**, **Sensors**, **Output**, **Vacuum Tubes**, **Meters**। সব দেখতে ট্যাবের সারি পাশে সোয়াইপ করুন।',
        'অথবা **সার্চ বক্সে** লিখুন। এটা নাম, কীওয়ার্ড ও ক্যাটাগরিতে খোঁজে, যেমন `thermistor`, `555`, `3 phase`, `fuse`।',
        'কম্পোনেন্টে ট্যাপ করুন। এটা দৃশ্যমান বোর্ডের মাঝামাঝি একটি ফাঁকা জায়গায় বসে। মেনু খোলা থাকে, তাই দরকার হলে আরও পার্টে ট্যাপ করুন।',
        '**✕** (বা Back বাটন) চেপে মেনু বন্ধ করুন।',
      ]),
      TIP('The **Recent** tab remembers the parts you used last, so common parts are one tap away.',
        '**Recent** ট্যাব আপনার শেষ ব্যবহার করা পার্ট মনে রাখে, তাই পরিচিত পার্ট এক ট্যাপেই পাবেন।'),
      TIP('Always add a **Ground** to your circuit (see {{ch:wiring}}). Many examples show where it goes.',
        'সার্কিটে সবসময় একটি **Ground** যোগ করুন ({{ch:wiring}} দেখুন)। অনেক উদাহরণে দেখা যায় এটা কোথায় বসে।'),
      P('The complete list of all 335 components, with what each one does and which values you can change, is in the chapter **Component library**.',
        'সবগুলো ৩৩৫টি কম্পোনেন্টের পূর্ণ তালিকা, প্রতিটি কী করে ও কোন মান বদলানো যায় সহ, **Component library** অধ্যায়ে আছে।'),
    ],
  },

  // ------------------------------------------------------------------ 6
  {
    id: 'editing', icon: 'hand',
    title: { en: 'Moving, selecting and editing parts', bn: 'পার্ট সরানো, সিলেক্ট ও এডিট করা' },
    blocks: [
      H('Select a part', 'পার্ট সিলেক্ট করা'),
      P('Tap it. It is highlighted and the **quick bar** appears near the bottom with:',
        'ট্যাপ করুন। হাইলাইট হবে আর নিচের দিকে **কুইক বার** আসবে, তাতে আছে:'),
      L([
        'Its **name** (R1, C2, D1…), type and a live reading (for example `3.84 V · 816 µA`). Tap this area to open all properties.',
        '**Reverse polarity** (only for polarised parts such as batteries, diodes, LEDs, electrolytic capacitors): swaps the two terminals while the wires stay connected.',
        '**Rotate**: turns the part 90° each tap.',
        '**Scope**: adds the part to the oscilloscope.',
        '**Edit** (sliders icon): opens the properties sheet.',
        '**Delete**.',
      ], [
        'এর **নাম** (R1, C2, D1…), ধরন ও লাইভ রিডিং (যেমন `3.84 V · 816 µA`)। এই অংশে ট্যাপ করলে সব প্রপার্টিজ খোলে।',
        '**Reverse polarity** (শুধু পোলারিটিযুক্ত পার্টে, যেমন ব্যাটারি, ডায়োড, LED, ইলেক্ট্রোলাইটিক ক্যাপাসিটর): তার লেগে থেকেই দুই টার্মিনাল অদলবদল করে।',
        '**Rotate**: প্রতি ট্যাপে পার্ট ৯০° ঘোরায়।',
        '**Scope**: পার্টটিকে অসিলোস্কোপে যোগ করে।',
        '**Edit** (স্লাইডার আইকন): প্রপার্টিজ শিট খোলে।',
        '**Delete**।',
      ]),
      H('Properties sheet', 'প্রপার্টিজ শিট'),
      P('Hold a part for half a second, or tap its name in the quick bar. A sheet slides up with:',
        'পার্টে আধা সেকেন্ড চেপে ধরুন, অথবা কুইক বারে নামে ট্যাপ করুন। একটি শিট উঠে আসবে, তাতে আছে:'),
      L([
        '**Live readings** while the simulation runs (voltage, current, power, state…).',
        'Action buttons: **Rotate**, **Flip** (mirror), **Copy**, **Scope V** (voltage across the part), **Scope I** (current through it), **Delete**.',
        'Every adjustable property: a text box and a slider for numbers, a drop-down for choices (for example the **model** of a transistor or op-amp), a switch for yes/no.',
        'A short description of the part.',
        'Tap the **✓** to close.',
      ], [
        'সিমুলেশন চলার সময় **লাইভ রিডিং** (ভোল্টেজ, কারেন্ট, পাওয়ার, অবস্থা…)।',
        'অ্যাকশন বাটন: **Rotate**, **Flip** (আয়না), **Copy**, **Scope V** (পার্টের দুই প্রান্তের ভোল্টেজ), **Scope I** (এর ভেতর দিয়ে কারেন্ট), **Delete**।',
        'প্রতিটি পরিবর্তনযোগ্য প্রপার্টি: সংখ্যার জন্য টেক্সট বক্স ও স্লাইডার, পছন্দের জন্য ড্রপ-ডাউন (যেমন ট্রানজিস্টর বা অপ-অ্যাম্পের **model**), হ্যাঁ/না-র জন্য সুইচ।',
        'পার্টের সংক্ষিপ্ত বর্ণনা।',
        'বন্ধ করতে **✓** চাপুন।',
      ]),
      P('Choosing a **model** (for example `2N3904`, `LM741`, `1N4148`) fills in all the matching numbers at once. If you then change one number by hand, the model switches to **custom**.',
        '**model** বাছলে (যেমন `2N3904`, `LM741`, `1N4148`) সংশ্লিষ্ট সব সংখ্যা একসাথে বসে যায়। এরপর হাতে একটি সংখ্যা বদলালে model **custom** হয়ে যায়।'),
      H('Typing values', 'মান টাইপ করা'),
      P('Number boxes understand engineering prefixes. You can type any of these:',
        'নাম্বার বক্স ইঞ্জিনিয়ারিং প্রিফিক্স বোঝে। এগুলোর যেকোনোটি লিখতে পারেন:'),
      T([['You type', 'আপনি লেখেন'], ['Meaning', 'মানে']], [
        [['`4.7k`  or  `4k7`', '`4.7k`  বা  `4k7`'], ['4 700', '৪ ৭০০']],
        [['`10u`  or  `10µ`', '`10u`  বা  `10µ`'], ['0.000 01  (10 micro)', '০.০০০০১  (১০ মাইক্রো)']],
        [['`2.2M`  or  `2.2meg`', '`2.2M`  বা  `2.2meg`'], ['2 200 000', '২২,০০,০০০']],
        [['`100n`, `47p`, `5m`', '`100n`, `47p`, `5m`'], ['100 nano, 47 pico, 5 milli', '১০০ ন্যানো, ৪৭ পিকো, ৫ মিলি']],
        [['`1e-3`', '`1e-3`'], ['0.001', '০.০০১']],
      ]),
      P('Note: `m` is **milli** and `M` is **mega**. The unit letter (Ω, F, H, V, A) is added by the app; you do not need to type it.',
        'মনে রাখুন: `m` মানে **মিলি**, আর `M` মানে **মেগা**। ইউনিটের অক্ষর (Ω, F, H, V, A) অ্যাপ নিজে বসায়; আপনাকে লিখতে হবে না।'),
      H('Move, rotate, flip, copy, delete', 'সরানো, ঘোরানো, ফ্লিপ, কপি, ডিলিট'),
      L([
        '**Move**: drag the part. It snaps to the grid. Connected wires follow and re-route neatly. The undo button reverses the move.',
        '**Rotate**: quick bar button (or **R** on a keyboard).',
        '**Flip**: properties sheet (mirrors the part).',
        '**Copy**: properties sheet or selection bar. The copy appears slightly down and right.',
        '**Delete**: quick bar or selection bar.',
      ], [
        '**সরানো**: পার্ট টানুন। এটা গ্রিডে স্ন্যাপ হয়। লাগানো তার সাথে আসে এবং সুন্দরভাবে নতুন করে রুট হয়। Undo দিলে সরানো ফিরে যায়।',
        '**ঘোরানো**: কুইক বারের বাটন (বা কিবোর্ডে **R**)।',
        '**Flip**: প্রপার্টিজ শিটে (পার্ট আয়নার মতো উল্টে দেয়)।',
        '**Copy**: প্রপার্টিজ শিট বা সিলেকশন বার থেকে। কপিটি একটু নিচে-ডানে বসে।',
        '**Delete**: কুইক বার বা সিলেকশন বার থেকে।',
      ]),
      H('Selecting many parts', 'একসাথে অনেক পার্ট সিলেক্ট'),
      S([
        'Tap **Select** in the toolbar (it turns blue). Or just hold empty space and drag a box.',
        'Drag a box **from left to right** = **window**: only parts and wires **completely inside** are selected.',
        'Drag a box **from right to left** = **crossing**: everything the box **touches** is selected.',
        'While Select is on, tap parts or wires one by one to add or remove them.',
        'A **selection bar** shows how many parts and wires are selected, with **Rotate**, **Copy**, **Delete** and **✕** (clear). Dragging any selected part moves them all together.',
        'Tap **Select** again to leave the mode.',
      ], [
        'টুলবারে **Select** চাপুন (নীল হবে)। অথবা ফাঁকা জায়গায় চেপে ধরে বক্স টানুন।',
        '**বাঁ থেকে ডানে** বক্স টানলে = **window**: শুধু **সম্পূর্ণ ভেতরে** থাকা পার্ট ও তার সিলেক্ট হয়।',
        '**ডান থেকে বাঁয়ে** বক্স টানলে = **crossing**: বক্স যা **ছুঁয়ে যায়** সবকিছু সিলেক্ট হয়।',
        'Select চালু থাকলে একটি একটি করে পার্ট বা তারে ট্যাপ করে যোগ বা বাদ দিন।',
        '**সিলেকশন বার** দেখায় কতগুলো পার্ট ও তার সিলেক্ট হয়েছে, সাথে **Rotate**, **Copy**, **Delete** ও **✕** (বাতিল)। সিলেক্ট করা যেকোনো পার্ট টানলে সবগুলো একসাথে সরে।',
        'মোড থেকে বের হতে আবার **Select** চাপুন।',
      ]),
      H('Undo and redo', 'Undo ও Redo'),
      P('Every change (adding, moving, wiring, changing a value, deleting) can be undone. The app remembers your last 120 steps. Undo and Redo are greyed out when there is nothing to undo or redo.',
        'প্রতিটি পরিবর্তন (যোগ, সরানো, তার টানা, মান বদল, মুছা) Undo করা যায়। অ্যাপ শেষ ১২০টি ধাপ মনে রাখে। কিছু Undo/Redo করার না থাকলে বাটন ধূসর থাকে।'),
    ],
  },

  // ------------------------------------------------------------------ 7
  {
    id: 'wiring', icon: 'wire',
    title: { en: 'Wiring', bn: 'ওয়্যারিং (তার টানা)' },
    blocks: [
      H('Draw a wire: tap, tap', 'তার আঁকা: ট্যাপ, ট্যাপ'),
      P('The quickest way, as in EveryCircuit: tap two terminals and the app draws the wire for you.',
        'সবচেয়ে সহজ উপায়, EveryCircuit-এর মতো: দুটি টার্মিনালে ট্যাপ করুন, অ্যাপ নিজেই তার এঁকে দেবে।'),
      S([
        '**Tap a terminal** (the small circle at the end of a part). It lights up with a pulsing ring. (The first time, a short hint tells you what to do next.)',
        '**Tap another terminal.** A neat right-angled wire is drawn between them, going round parts where it can.',
        'You can also tap **a point on an existing wire** (to branch from it) or **the body of a part** (the wire goes to its nearest terminal).',
        'Changed your mind? Tap **empty space** or the same terminal again, or press **Back**, to cancel.',
      ], [
        '**একটি টার্মিনালে ট্যাপ করুন** (পার্টের মাথার ছোট গোল)। এটি জ্বলে ওঠে, চারপাশে একটি রিং স্পন্দিত হয়। (প্রথমবার পরের ধাপ বলে দিতে একটি ছোট হিন্ট আসে।)',
        '**আরেকটি টার্মিনালে ট্যাপ করুন।** দুটির মাঝে সমকোণে সুন্দর একটি তার আঁকা হয়, সম্ভব হলে পার্ট এড়িয়ে।',
        '**আগের কোনো তারের ওপর একটি বিন্দুতেও** ট্যাপ করা যায় (সেখান থেকে শাখা নিতে), বা **কোনো পার্টের শরীরে** (তার তার কাছের টার্মিনালে যাবে)।',
        'মত বদলালে **ফাঁকা জায়গায়** বা আবার একই টার্মিনালে ট্যাপ করুন, অথবা **Back** চাপুন: বাতিল হয়ে যাবে।',
      ]),
      H('Branches and junctions', 'শাখা ও জাংশন'),
      L([
        'To branch from an existing wire, tap **a point on that wire** as the first or the second end of a new wire. The two are then electrically joined.',
        'A **dot** marks a junction where three or more connections meet.',
        'Two wires that simply **cross** each other are **not** connected. They connect only where one ends on the other, or at a terminal.',
      ], [
        'আগের তার থেকে শাখা বের করতে নতুন তারের প্রথম বা দ্বিতীয় প্রান্ত হিসেবে **ওই তারের কোনো বিন্দুতে** ট্যাপ করুন। দুটি তখন বৈদ্যুতিকভাবে জুড়ে যায়।',
        'তিন বা ততোধিক সংযোগ মিললে সেখানে একটি **ডট** জংশন চিহ্নিত করে।',
        'দুটি তার শুধু একটার ওপর দিয়ে আরেকটা **পেরিয়ে** গেলে সংযোগ হয় **না**। সংযোগ হয় কেবল যেখানে একটির প্রান্ত অন্যটিতে শেষ হয়, বা টার্মিনালে।',
      ]),
      H('Edit wires', 'তার এডিট করা'),
      L([
        '**Tap a wire** to select it. The selection bar offers **Scope** (probe its voltage) and **Delete**.',
        'Moving a part drags its wires along; they are re-routed so they do not run through other parts.',
        'To redo a wire, delete it and draw it again.',
      ], [
        'তারে **ট্যাপ** করলে সিলেক্ট হয়। সিলেকশন বারে **Scope** (এর ভোল্টেজ প্রোব) ও **Delete** পাবেন।',
        'পার্ট সরালে তার সাথে সাথে আসে; অন্য পার্টের ভেতর দিয়ে না যায় সেভাবে নতুন করে রুট হয়।',
        'তার নতুন করে টানতে মুছে আবার আঁকুন।',
      ]),
      H('Ground', 'গ্রাউন্ড'),
      P('Voltages are measured against **ground (0 V)**. Add a **Ground** symbol (Sources category) and connect it to the point you call 0 V, usually the battery **−**. **Protective Earth** and **Chassis Ground** are also 0 V.',
        'ভোল্টেজ মাপা হয় **গ্রাউন্ড (0 V)**-এর সাপেক্ষে। একটি **Ground** চিহ্ন (Sources ক্যাটাগরি) যোগ করুন এবং যেটাকে 0 V ধরছেন সেখানে জুড়ুন, সাধারণত ব্যাটারির **−**। **Protective Earth** ও **Chassis Ground**-ও 0 V।'),
      TIP('If you forget ground, the simulator ties each separate part of the circuit to 0 V by itself, so it still runs. But for clear, meaningful readings always add one ground.',
        'গ্রাউন্ড ভুলে গেলেও সিমুলেটর সার্কিটের আলাদা অংশগুলোকে নিজেই 0 V-এর সাথে বেঁধে নেয়, তাই চলে। তবে পরিষ্কার, অর্থপূর্ণ রিডিংয়ের জন্য সবসময় একটি গ্রাউন্ড দিন।'),
      H('Wiring checklist', 'ওয়্যারিং চেকলিস্ট'),
      L([
        'Every wire end must sit **on a terminal circle** (or on another wire). A wire that stops near it is not connected.',
        'A closed loop is needed for current to flow: source → parts → back to the source.',
        'Do not connect ideal voltage sources directly across each other, and do not leave a current source with nowhere to push its current.',
        'Check polarity: battery **+**, diode and LED **anode/cathode**, electrolytic capacitor **+**.',
      ], [
        'প্রতিটি তারের মাথা **টার্মিনালের গোলের ওপর** (বা অন্য তারের ওপর) থাকতে হবে। কাছাকাছি এসে থেমে গেলে সংযোগ হয় না।',
        'কারেন্ট বইতে বদ্ধ লুপ লাগে: সোর্স → পার্ট → আবার সোর্সে ফেরা।',
        'আইডিয়াল ভোল্টেজ সোর্স সরাসরি একটির সাথে আরেকটি জুড়বেন না, আর কারেন্ট সোর্সকে এমনভাবে রাখবেন না যে তার কারেন্ট যাওয়ার জায়গা নেই।',
        'পোলারিটি দেখুন: ব্যাটারি **+**, ডায়োড ও LED-এর **অ্যানোড/ক্যাথোড**, ইলেক্ট্রোলাইটিক ক্যাপাসিটরের **+**।',
      ]),
    ],
  },

  // ------------------------------------------------------------------ 8
  {
    id: 'values', icon: 'gauge',
    title: { en: 'Changing values and the knob', bn: 'মান বদলানো ও নব' },
    blocks: [
      P('There are three ways to change a value. All of them also work **while the circuit is running**, so you see the effect immediately.',
        'মান বদলানোর তিনটি উপায় আছে। সবগুলোই **সার্কিট চলা অবস্থাতেও** কাজ করে, তাই ফল সাথে সাথে দেখা যায়।'),
      L([
        '**Type it** in the properties sheet (for example `2.2k`).',
        '**Drag the slider** under the number in the properties sheet.',
        '**Turn the knob** that appears next to a selected part.',
      ], [
        'প্রপার্টিজ শিটে **টাইপ করে** (যেমন `2.2k`)।',
        'প্রপার্টিজ শিটে সংখ্যার নিচের **স্লাইডার টেনে**।',
        'সিলেক্ট করা পার্টের পাশে আসা **নব ঘুরিয়ে**।',
      ]),
      H('The knob', 'নব'),
      P('When you select a part, a round **knob** shows its main value (resistance of a resistor, voltage of a source, temperature of an NTC, light level of an LDR, duty cycle of a PWM source, and so on). The value is written above the dial. There are two kinds:',
        'পার্ট সিলেক্ট করলে একটি গোল **নব** তার মূল মান দেখায় (রেজিস্টরের রেজিস্ট্যান্স, সোর্সের ভোল্টেজ, NTC-র তাপমাত্রা, LDR-এর আলো, PWM সোর্সের ডিউটি ইত্যাদি)। মান ডায়ালের ওপরে লেখা থাকে। নব দুই রকম:'),
      T([['Kind', 'ধরন'], ['How it works', 'কীভাবে কাজ করে']], [
        [['**Decade dial** (resistance, capacitance, inductance, frequency…)', '**ডেকেড ডায়াল** (রেজিস্ট্যান্স, ক্যাপাসিট্যান্স, ইন্ডাকট্যান্স, ফ্রিকোয়েন্সি…)'],
          ['The digits 1 to 9 are printed round the ring. Turn the dial: each click goes 1 → 2 → … → 9 → 10 → 20 → … Tap a digit to jump straight to it. The **−** and **+** buttons change the value by one tenth of a digit (for example 4.7 kΩ, 1.5 µF) and roll into the next decade.', '১ থেকে ৯ সংখ্যা রিংয়ে ছাপা। ডায়াল ঘোরালে প্রতি ক্লিকে ১ → ২ → … → ৯ → ১০ → ২০ → … হয়। কোনো সংখ্যায় ট্যাপ করলে সরাসরি সেখানে যায়। **−** ও **+** বাটন এক ডিজিটের দশ ভাগের এক ভাগ করে বদলায় (যেমন 4.7 kΩ, 1.5 µF) এবং পরের ডেকেডে গড়িয়ে যায়।']],
        [['**Stepped knob** (volts, %, °, °C, …)', '**স্টেপড নব** (ভোল্ট, %, °, °C, …)'],
          ['Each click moves one whole step that follows the value you see: 1 to 99 move by 1 (5 V → 6 V), 100 to 999 by 10 (230 V → 240 V), 10 mA → 11 mA. **−** and **+** make a finer step.', 'প্রতি ক্লিকে আপনি যে মান দেখছেন তার সাথে মানানসই পুরো একটি ধাপ চলে: ১ থেকে ৯৯ পর্যন্ত ১ করে (5 V → 6 V), ১০০ থেকে ৯৯৯ পর্যন্ত ১০ করে (230 V → 240 V), 10 mA → 11 mA। **−** ও **+** সূক্ষ্মতর ধাপে চলে।']],
      ]),
      P('You can also drag a finger round the dial to turn it. You feel a small vibration at each click (turn off in Settings → Haptic feedback).',
        'ডায়ালের চারপাশে আঙুল ঘুরিয়েও ঘোরানো যায়। প্রতি ক্লিকে হালকা ভাইব্রেশন পাবেন (Settings → Haptic feedback থেকে বন্ধ করা যায়)।'),
      TIP('The knob can cover a small part on a small screen. The board slides up a little to keep the new part visible. You can also pan the board yourself.',
        'ছোট স্ক্রিনে নব কোনো পার্ট ঢেকে দিতে পারে। নতুন পার্ট দেখা যাওয়ার জন্য বোর্ড একটু ওপরে সরে যায়। নিজেও বোর্ড পান করতে পারেন।'),
      H('Which value is on the knob?', 'নবে কোন মানটি থাকে?'),
      P('Each component decides. Resistor → resistance; capacitor → capacitance; DC source → voltage; AC source → frequency or amplitude; potentiometer → wiper position; LDR → light; NTC → temperature; PWM generator → duty cycle; and so on. The other values are always in the properties sheet.',
        'প্রতিটি কম্পোনেন্ট নিজেই ঠিক করে। রেজিস্টর → রেজিস্ট্যান্স; ক্যাপাসিটর → ক্যাপাসিট্যান্স; DC সোর্স → ভোল্টেজ; AC সোর্স → ফ্রিকোয়েন্সি বা অ্যামপ্লিটিউড; পটেনশিওমিটার → ওয়াইপারের অবস্থান; LDR → আলো; NTC → তাপমাত্রা; PWM জেনারেটর → ডিউটি সাইকেল ইত্যাদি। বাকি মানগুলো সবসময় প্রপার্টিজ শিটে পাবেন।'),
    ],
  },

  // ------------------------------------------------------------------ 9
  {
    id: 'running', icon: 'speed',
    title: { en: 'Running the simulation', bn: 'সিমুলেশন চালানো' },
    blocks: [
      H('Run, pause, restart, step', 'Run, Pause, Restart, Step'),
      L([
        '**Run** starts the simulation from time zero. The button then becomes **Pause**; after pausing it reads **Resume**.',
        '**Restart** resets time to zero and everything inside parts (capacitor charge, inductor current, counters, motor speed, tripped breakers) to the start.',
        '**Step** advances one small slice of time and stays paused. Use it to watch fast events slowly.',
        'The screen stays awake while the simulation runs.',
        'If the circuit has no components, the app tells you to add some first.',
      ], [
        '**Run** শূন্য সময় থেকে সিমুলেশন শুরু করে। তখন বাটন **Pause** হয়ে যায়; থামালে লেখা আসে **Resume**।',
        '**Restart** সময় শূন্যে ফেরায় এবং পার্টের ভেতরের সবকিছু (ক্যাপাসিটরের চার্জ, ইন্ডাক্টরের কারেন্ট, কাউন্টার, মোটরের গতি, ট্রিপ করা ব্রেকার) শুরুর অবস্থায় আনে।',
        '**Step** অল্প সময় এগিয়ে থেমে থাকে। দ্রুত ঘটনা ধীরে দেখতে ব্যবহার করুন।',
        'সিমুলেশন চলার সময় স্ক্রিন জেগে থাকে।',
        'সার্কিটে কোনো কম্পোনেন্ট না থাকলে অ্যাপ আগে কিছু যোগ করতে বলে।',
      ]),
      H('What you see while it runs', 'চলার সময় কী কী দেখবেন'),
      T([['Display', 'যা দেখা যায়'], ['Meaning', 'মানে']], [
        [['Green wire', 'সবুজ তার'], ['Positive voltage (stronger colour = higher voltage).', 'পজিটিভ ভোল্টেজ (রং যত গাঢ় তত বেশি ভোল্টেজ)।']],
        [['Red wire', 'লাল তার'], ['Negative voltage (stronger colour = more negative).', 'নেগেটিভ ভোল্টেজ (রং যত গাঢ় তত বেশি নেগেটিভ)।']],
        [['Grey wire', 'ধূসর তার'], ['About 0 V.', 'প্রায় 0 V।']],
        [['Yellow moving dots', 'হলুদ চলমান ডট'], ['Current. Dots move in the direction of current; faster/denser = more current.', 'কারেন্ট। ডট কারেন্টের দিকে চলে; যত দ্রুত/ঘন তত বেশি কারেন্ট।']],
        [['Blue number on a wire', 'তারের ওপর নীল সংখ্যা'], ['The voltage of that net (Settings → Live node voltages).', 'ওই নেটের ভোল্টেজ (Settings → Live node voltages)।']],
        [['Green number with arrow beside a part', 'পার্টের পাশে তীরসহ সবুজ সংখ্যা'], ['The current through the part and its direction (Settings → Live currents).', 'পার্টের ভেতর দিয়ে কারেন্ট ও তার দিক (Settings → Live currents)।']],
        [['+ / − on capacitor plates', 'ক্যাপাসিটরের প্লেটে + / −'], ['Stored charge (Settings → Capacitor charge).', 'জমা চার্জ (Settings → Capacitor charge)।']],
        [['Glowing LED, lamp, moving motor, lit segment', 'জ্বলন্ত LED, বাল্ব, ঘুরন্ত মোটর, জ্বলা সেগমেন্ট'], ['Parts animate to show their state.', 'পার্টগুলো নিজেদের অবস্থা অ্যানিমেশনে দেখায়।']],
      ]),
      H('AC circuits: RMS readings', 'AC সার্কিট: RMS রিডিং'),
      P('In a circuit with a sine supply (AC source, mains, 3-phase), the live labels show the **RMS** over one supply cycle, like a real meter, for example `12 V~` on the secondary of a 230 V : 12-0-12 V transformer. DC nets show their average. Voltmeters and ammeters are set to **Auto** and show RMS in AC circuits. To see instantaneous values instead, use **Settings → AC readings → Instantaneous**.',
        'সাইন সাপ্লাইওয়ালা সার্কিটে (AC সোর্স, মেইনস, থ্রি-ফেজ) লাইভ লেবেল এক সাপ্লাই সাইকেলের **RMS** দেখায়, সত্যিকারের মিটারের মতো; যেমন 230 V : 12-0-12 V ট্রান্সফরমারের সেকেন্ডারিতে `12 V~`। DC নেট দেখায় গড় মান। ভোল্টমিটার ও অ্যামমিটার **Auto**-তে থাকে এবং AC সার্কিটে RMS দেখায়। তাৎক্ষণিক মান দেখতে **Settings → AC readings → Instantaneous** করুন।'),
      H('Simulation speed', 'সিমুলেশনের গতি'),
      P('Tap the chip at the top of the board (`t = … · …/s`). A small panel opens:',
        'বোর্ডের উপরের চিপে (`t = … · …/s`) ট্যাপ করুন। একটি ছোট প্যানেল খুলবে:'),
      L([
        '**Simulation speed**: how much circuit time passes per real second. Slide left for slow motion (to see a fast oscillation), right for fast (to see a slow charge).',
        '**Timestep Δt**: the internal step the solver uses (it is chosen automatically from the speed and the highest frequency).',
        '**Automatic**: tick it to let the app choose a speed that suits your sources. Moving the slider switches Automatic off for this circuit.',
      ], [
        '**Simulation speed**: প্রতি বাস্তব সেকেন্ডে সার্কিটের কতটা সময় কাটবে। বাঁয়ে সরালে স্লো-মোশন (দ্রুত দোলন দেখতে), ডানে সরালে দ্রুত (ধীর চার্জ দেখতে)।',
        '**Timestep Δt**: সলভার যে অভ্যন্তরীণ ধাপ ব্যবহার করে (গতি ও সর্বোচ্চ ফ্রিকোয়েন্সি থেকে নিজে ঠিক হয়)।',
        '**Automatic**: টিক দিলে অ্যাপ আপনার সোর্সের উপযোগী গতি নিজে বাছে। স্লাইডার সরালে এই সার্কিটের জন্য Automatic বন্ধ হয়ে যায়।',
      ]),
      P('If the chip says **CPU-limited**, the phone cannot calculate as fast as you asked: lower the speed, or simplify the circuit. The app also lowers the drawing sharpness automatically on slow phones to keep animation smooth.',
        'চিপে **CPU-limited** লেখা এলে ফোন আপনার চাওয়া গতিতে হিসাব করতে পারছে না: গতি কমান বা সার্কিট সহজ করুন। ধীর ফোনে অ্যানিমেশন মসৃণ রাখতে অ্যাপ নিজেই ছবির স্পষ্টতা কমিয়ে দেয়।'),
      H('Interactive parts', 'ইন্টারঅ্যাকটিভ পার্ট'),
      P('While running you can touch the circuit like a real one:',
        'চলার সময় সত্যিকারের সার্কিটের মতো ছুঁয়ে দেখতে পারেন:'),
      T([['Part', 'পার্ট'], ['Touch', 'স্পর্শ']], [
        [['Switches (one-way, two-way, intermediate, DPST, DPDT, isolator, rotary…)', 'সুইচ (one-way, two-way, intermediate, DPST, DPDT, isolator, rotary…)'], ['Tap to toggle.', 'ট্যাপে টগল হয়।']],
        [['Push buttons (NO / NC)', 'পুশ বাটন (NO / NC)'], ['Hold to press, release to let go.', 'চেপে ধরলে চাপা থাকে, ছাড়লে ছুটে যায়।']],
        [['Latching push button, emergency stop', 'Latching পুশ বাটন, ইমার্জেন্সি স্টপ'], ['Tap to press and latch; tap again to release.', 'ট্যাপে চেপে লক হয়; আবার ট্যাপ করলে ছুটে যায়।']],
        [['MCB, MCCB, RCCB, RCBO', 'MCB, MCCB, RCCB, RCBO'], ['Tap to switch on/off. After a trip, tap once to **reset**.', 'ট্যাপে অন/অফ। ট্রিপের পর একবার ট্যাপ করলে **রিসেট** হয়।']],
        [['Overload relay, IDMT relay', 'Overload relay, IDMT relay'], ['Tap to reset after a trip.', 'ট্রিপের পর ট্যাপ করে রিসেট।']],
        [['Logic input, hex input', 'Logic input, hex input'], ['Tap to flip a bit / step the value.', 'ট্যাপে বিট উল্টায় / মান এক ধাপ বাড়ায়।']],
        [['PIR sensor', 'PIR সেন্সর'], ['Tap to simulate motion.', 'ট্যাপে "নড়াচড়া" ঘটে।']],
        [['Capacitive touch sensor', 'ক্যাপাসিটিভ টাচ সেন্সর'], ['Tap to touch / release.', 'ট্যাপে টাচ / ছাড়া।']],
        [['Peak meter, kWh meter', 'Peak meter, kWh meter'], ['Tap to reset.', 'ট্যাপে রিসেট।']],
      ]),
      H('Errors and warnings', 'এরর ও ওয়ার্নিং'),
      P('If the circuit cannot be solved, a bar at the top tells you what and where, for example **"Circuit cannot be solved (singular matrix) near R3. Check for floating current sources or open circuits."** The part concerned is highlighted. A yellow bar is a warning, for example "D1 is short-circuited". See **Troubleshooting** for what to do.',
        'সার্কিট সলভ করা না গেলে উপরের বার বলে দেয় কী এবং কোথায়, যেমন **"Circuit cannot be solved (singular matrix) near R3. Check for floating current sources or open circuits."** সংশ্লিষ্ট পার্ট হাইলাইট হয়। হলুদ বার মানে ওয়ার্নিং, যেমন "D1 is short-circuited"। কী করবেন তা **Troubleshooting**-এ আছে।'),
    ],
  },

  // ------------------------------------------------------------------ 10
  {
    id: 'scope', icon: 'scope',
    title: { en: 'Oscilloscope', bn: 'অসিলোস্কোপ' },
    blocks: [
      P('The oscilloscope draws voltages and currents against time, up to **6 channels** at once, each in its own colour.',
        'অসিলোস্কোপ সময়ের সাপেক্ষে ভোল্টেজ ও কারেন্ট আঁকে, একসাথে সর্বোচ্চ **৬টি চ্যানেল**, প্রতিটি আলাদা রঙে।'),
      H('Add a channel (probe)', 'চ্যানেল (প্রোব) যোগ করা'),
      L([
        '**A node voltage**: tap a wire, then tap **Scope** in the selection bar. The probe is placed at the point you tapped and measures that net against ground.',
        '**Voltage across a part**: select the part, tap the **scope** icon in the quick bar (or **Scope V** in the properties sheet).',
        '**Current through a part**: select the part and tap **Scope I** in its properties sheet.',
        'The scope panel opens automatically. A coloured pin on the board marks where each probe is.',
      ], [
        '**নোডের ভোল্টেজ**: তারে ট্যাপ করে সিলেকশন বারে **Scope** চাপুন। যেখানে ট্যাপ করেছেন সেখানে প্রোব বসে এবং ওই নেটের ভোল্টেজ গ্রাউন্ডের সাপেক্ষে মাপে।',
        '**পার্টের দুই প্রান্তের ভোল্টেজ**: পার্ট সিলেক্ট করে কুইক বারের **স্কোপ** আইকন (বা প্রপার্টিজ শিটে **Scope V**) চাপুন।',
        '**পার্টের ভেতর দিয়ে কারেন্ট**: পার্ট সিলেক্ট করে প্রপার্টিজ শিটে **Scope I** চাপুন।',
        'স্কোপ প্যানেল নিজে থেকেই খুলে যায়। বোর্ডে রঙিন পিন দেখায় প্রতিটি প্রোব কোথায়।',
      ]),
      P('Channel colours: yellow, cyan, pink, green, orange, purple. Probes are saved with the circuit.',
        'চ্যানেলের রং: হলুদ, সায়ান, গোলাপি, সবুজ, কমলা, বেগুনি। প্রোব সার্কিটের সাথে সেভ হয়।'),
      H('Reading the display', 'ডিসপ্লে পড়া'),
      L([
        'Each channel **auto-scales** to fit; the highest and lowest values of the screen are written at the right edge in the channel colour.',
        'The bottom right corner shows the **time per division** (for example `2 ms/div`). There are 10 divisions across.',
        'Under the graph, one line per channel gives the **latest value**, **pp** (peak-to-peak), **rms** and the **frequency f** (found from the signal).',
        'A bright dot on the right edge marks the live value.',
      ], [
        'প্রতিটি চ্যানেল নিজে থেকে **অটো-স্কেল** হয়ে ফিট করে; স্ক্রিনের সর্বোচ্চ ও সর্বনিম্ন মান ডানদিকে চ্যানেলের রঙে লেখা থাকে।',
        'ডানদিকের নিচের কোণে **প্রতি ডিভিশনে সময়** দেখায় (যেমন `2 ms/div`)। আড়াআড়ি ১০টি ডিভিশন।',
        'গ্রাফের নিচে প্রতি চ্যানেলের জন্য এক লাইনে **সর্বশেষ মান**, **pp** (পিক-টু-পিক), **rms** ও **ফ্রিকোয়েন্সি f** (সিগন্যাল থেকে নির্ণীত)।',
        'ডানপাশে উজ্জ্বল ডট লাইভ মান বোঝায়।',
      ]),
      H('Scope buttons', 'স্কোপের বাটন'),
      T([['Button', 'বাটন'], ['What it does', 'কী করে']], [
        [['+  /  −', '+  /  −'], ['Zoom the time axis in / out (half or double the time window). You can also pinch on the scope.', 'টাইম অক্ষ জুম ইন/আউট (সময়ের জানালা অর্ধেক বা দ্বিগুণ)। স্কোপে চিমটি কেটেও করা যায়।']],
        [['Mode', 'Mode'], ['Cycles **Time → FFT → XY → Time**. XY needs at least 2 channels.', '**Time → FFT → XY → Time** ঘোরায়। XY-এর জন্য কমপক্ষে ২টি চ্যানেল লাগে।']],
        [['Freeze', 'Freeze'], ['Stops recording so you can study the picture. Press again to continue.', 'রেকর্ডিং থামায়, ছবি ভালোভাবে দেখার জন্য। আবার চাপলে চলে।']],
        [['Download', 'Download'], ['Exports the recorded data as a CSV file (time, then one column per channel).', 'রেকর্ড করা ডেটা CSV ফাইলে এক্সপোর্ট করে (সময়, তারপর প্রতি চ্যানেলের একটি কলাম)।']],
        [['Colour chip with ✕', 'রঙিন চিপ ও ✕'], ['Tap a channel chip to remove that probe.', 'চ্যানেলের চিপে ট্যাপ করলে ওই প্রোব মুছে যায়।']],
      ]),
      H('Time, FFT and XY views', 'Time, FFT ও XY ভিউ'),
      L([
        '**Time**: normal waveform view.',
        '**FFT** (spectrum): shows how much of each frequency is in the signal, on a log frequency axis and a 0 to −100 dB scale. Under it you see the **peak frequency** of each channel. A pure sine shows one tall peak; a square wave shows odd harmonics; a rectifier shows the ripple frequency.',
        '**XY**: channel 1 is drawn along X and channel 2 along Y, like a real scope in XY mode. Use it for Lissajous figures, phase comparison and I–V curves.',
      ], [
        '**Time**: সাধারণ তরঙ্গরূপ।',
        '**FFT** (স্পেকট্রাম): সিগন্যালে কোন ফ্রিকোয়েন্সি কতটা আছে তা দেখায়, লগ ফ্রিকোয়েন্সি অক্ষ ও 0 থেকে −100 dB স্কেলে। নিচে প্রতি চ্যানেলের **পিক ফ্রিকোয়েন্সি** দেখায়। বিশুদ্ধ সাইনে একটি উঁচু পিক, স্কয়ার ওয়েভে বিজোড় হারমোনিক, আর রেকটিফায়ারে রিপলের ফ্রিকোয়েন্সি দেখা যায়।',
        '**XY**: চ্যানেল ১ X-অক্ষে ও চ্যানেল ২ Y-অক্ষে আঁকা হয়, সত্যিকারের স্কোপের XY মোডের মতো। লিসাজু ফিগার, ফেজ তুলনা ও I–V কার্ভের জন্য ব্যবহার করুন।',
      ]),
      TIP('The scope keeps the most recent 4096 points. If a signal looks too fast or too slow, change the **time scale** (+ / −) or the **simulation speed** ({{ch:running}}).',
        'স্কোপ সবচেয়ে সাম্প্রতিক ৪০৯৬টি পয়েন্ট রাখে। সিগন্যাল খুব দ্রুত বা ধীর মনে হলে **টাইম স্কেল** (+ / −) বা **সিমুলেশনের গতি** ({{ch:running}}) বদলান।'),
    ],
  },

  // ------------------------------------------------------------------ 11
  {
    id: 'meter', icon: 'meter',
    title: { en: 'Multimeter', bn: 'মাল্টিমিটার' },
    blocks: [
      P('Tap the **multimeter** icon in the top bar. A meter card appears on the board with a red (+) and a black (−) probe pin. The simulation must be running.',
        'টপ বারের **মাল্টিমিটার** আইকন চাপুন। বোর্ডে একটি মিটার কার্ড আসবে, সাথে লাল (+) ও কালো (−) প্রোব পিন। সিমুলেশন চলা থাকতে হবে।'),
      T([['Mode', 'মোড'], ['How to use', 'ব্যবহার'], ['It shows', 'যা দেখায়']], [
        [['**V**', '**V**'], ['Drag the red and black probe pins onto two nodes (a terminal or a wire). The pins snap to connection points.', 'লাল ও কালো প্রোব পিন দুটি নোডে (টার্মিনাল বা তারে) টেনে বসান। পিন সংযোগ বিন্দুতে স্ন্যাপ করে।'], ['DC (average) voltage between the probes, plus AC RMS and the instantaneous value.', 'প্রোবদ্বয়ের মাঝের DC (গড়) ভোল্টেজ, সাথে AC RMS ও তাৎক্ষণিক মান।']],
        [['**Ω**', '**Ω**'], ['Place the probes across a part or network. The app switches off all sources and measures what is left.', 'প্রোব কোনো পার্ট বা নেটওয়ার্কের দুই প্রান্তে বসান। অ্যাপ সব সোর্স বন্ধ ধরে বাকিটা মাপে।'], ['Small-signal resistance (**OL** if open).', 'স্মল-সিগন্যাল রেজিস্ট্যান্স (খোলা থাকলে **OL**)।']],
        [['**A**', '**A**'], ['Select a two-terminal component. Probes are not used.', 'একটি দুই-টার্মিনালের কম্পোনেন্ট সিলেক্ট করুন। প্রোব লাগে না।'], ['Current through it: average, RMS and instantaneous.', 'এর ভেতর দিয়ে কারেন্ট: গড়, RMS ও তাৎক্ষণিক।']],
        [['**W**', '**W**'], ['Select a two-terminal component.', 'একটি দুই-টার্মিনালের কম্পোনেন্ট সিলেক্ট করুন।'], ['Average power in it (positive = absorbing power, negative = delivering).', 'এতে গড় পাওয়ার (পজিটিভ = শোষণ করছে, নেগেটিভ = দিচ্ছে)।']],
      ]),
      P('The display reads smoothly (about a 0.4 s average) so numbers do not flicker. Tap **✕** on the card to close the meter.',
        'ডিসপ্লে মসৃণভাবে পড়ে (প্রায় ০.৪ সেকেন্ডের গড়) যাতে সংখ্যা কাঁপে না। মিটার বন্ধ করতে কার্ডের **✕** চাপুন।'),
      TIP('For permanent meters inside the circuit, use parts from the **Meters** category (voltmeter, ammeter, wattmeter, power-factor meter, frequency meter, kWh meter…). They stay in the circuit and are saved with it.',
        'সার্কিটের ভেতরে স্থায়ী মিটার চাইলে **Meters** ক্যাটাগরির পার্ট (voltmeter, ammeter, wattmeter, power-factor meter, frequency meter, kWh meter…) ব্যবহার করুন। এগুলো সার্কিটেই থাকে ও সাথে সেভ হয়।'),
    ],
  },

  // ------------------------------------------------------------------ 12
  {
    id: 'analysis', icon: 'bode',
    title: { en: 'Analysis: Bode, DC sweep, operating point, SPICE', bn: 'অ্যানালাইসিস: Bode, DC sweep, operating point, SPICE' },
    blocks: [
      P('Tap the **Analysis** icon (top bar) or use **⋮ → Operating point / SPICE netlist**. There are four tabs. These tools solve the circuit mathematically and do not need the simulation to be running.',
        'টপ বারের **Analysis** আইকন চাপুন, অথবা **⋮ → Operating point / SPICE netlist** ব্যবহার করুন। চারটি ট্যাব আছে। এই টুলগুলো সার্কিট গাণিতিকভাবে সলভ করে, সিমুলেশন চালু থাকা লাগে না।'),
      H('1. AC Sweep (Bode plot)', '১. AC Sweep (Bode plot)'),
      P('Shows how the circuit responds to different frequencies: gain (in dB) and phase (in degrees). The input source is driven with 1 V at 0° and other sources are set to zero.',
        'বিভিন্ন ফ্রিকোয়েন্সিতে সার্কিট কেমন সাড়া দেয় তা দেখায়: গেইন (dB-তে) ও ফেজ (ডিগ্রিতে)। ইনপুট সোর্সকে 0° ফেজে 1 V দিয়ে চালানো হয়, বাকি সোর্স শূন্য ধরা হয়।'),
      S([
        'Place a source (voltage or current) and build your circuit. Make sure the output is **probed on the scope**: select the output wire and tap **Scope**.',
        'Open **Analysis → AC Sweep**.',
        'Choose the **Input source** and the **Output (scope probe)**.',
        'Set **Start frequency** (default 1 Hz), **Stop frequency** (default 1 MHz) and **Points per decade** (20, 50, 100 or 200).',
        'Tap **Run AC sweep**. The yellow curve is gain in dB; the cyan dashed curve is phase.',
        'Touch the graph and slide your finger to read the exact frequency, gain and phase at that point.',
        'Tap **CSV** to export the data.',
      ], [
        'একটি সোর্স (ভোল্টেজ বা কারেন্ট) বসিয়ে সার্কিট বানান। নিশ্চিত করুন আউটপুটে **স্কোপ প্রোব** আছে: আউটপুটের তার সিলেক্ট করে **Scope** চাপুন।',
        '**Analysis → AC Sweep** খুলুন।',
        '**Input source** ও **Output (scope probe)** বাছুন।',
        '**Start frequency** (ডিফল্ট 1 Hz), **Stop frequency** (ডিফল্ট 1 MHz) ও **Points per decade** (20, 50, 100 বা 200) দিন।',
        '**Run AC sweep** চাপুন। হলুদ রেখা dB-তে গেইন; সায়ান ড্যাশ রেখা ফেজ।',
        'গ্রাফে ছুঁয়ে আঙুল সরালে ওই বিন্দুর ঠিক ফ্রিকোয়েন্সি, গেইন ও ফেজ পড়া যায়।',
        'ডেটা এক্সপোর্ট করতে **CSV** চাপুন।',
      ]),
      P('The app marks and reports automatically: the **−3 dB** point(s) (cut-off frequency), the resonance peak **f₀**, the **bandwidth**, the **Q factor** and the **phase margin**, where they exist.',
        'অ্যাপ নিজেই চিহ্নিত করে ও জানায়: **−3 dB** বিন্দু (কাট-অফ ফ্রিকোয়েন্সি), রেজোন্যান্স পিক **f₀**, **ব্যান্ডউইথ**, **Q ফ্যাক্টর** ও **ফেজ মার্জিন**, যেখানে প্রযোজ্য।'),
      TIP('Try it: open the example **RC low-pass filter**, then Analysis → AC Sweep → Run. You should see −3 dB and −45° at about 1 kHz.',
        'চেষ্টা করুন: **RC low-pass filter** উদাহরণ খুলে Analysis → AC Sweep → Run করুন। প্রায় 1 kHz-এ −3 dB ও −45° দেখতে পাবেন।'),
      H('2. DC Sweep', '২. DC Sweep'),
      P('Changes one value step by step and solves the circuit at each step. Use it for I–V curves of diodes, transfer curves of transistors, sensor calibration or maximum-power-point searches.',
        'একটি মান ধাপে ধাপে বদলায় এবং প্রতি ধাপে সার্কিট সলভ করে। ডায়োডের I–V কার্ভ, ট্রানজিস্টরের ট্রান্সফার কার্ভ, সেন্সর ক্যালিব্রেশন বা ম্যাক্সিমাম-পাওয়ার-পয়েন্ট খুঁজতে ব্যবহার করুন।'),
      S([
        'Add scope probes for whatever you want to measure (a node voltage, a part voltage, or a part current).',
        'Open **Analysis → DC Sweep**.',
        'Choose the **Component** and the **Parameter** to sweep (for example V1 → Voltage).',
        'Enter **From**, **To** and **Steps** (default 100). The app fills a sensible range for you.',
        'Select one or more probes under **Measure** (tap to select several).',
        'Tap **Run DC sweep**. The curves are drawn; touch the graph to read values. **CSV** exports the data.',
      ], [
        'যা মাপতে চান তার জন্য স্কোপ প্রোব দিন (নোড ভোল্টেজ, পার্টের ভোল্টেজ বা পার্টের কারেন্ট)।',
        '**Analysis → DC Sweep** খুলুন।',
        'যে **Component** ও **Parameter** সুইপ করবেন তা বাছুন (যেমন V1 → Voltage)।',
        '**From**, **To** ও **Steps** দিন (ডিফল্ট 100)। অ্যাপ একটি যুক্তিসঙ্গত রেঞ্জ নিজেই বসিয়ে দেয়।',
        '**Measure**-এর নিচে এক বা একাধিক প্রোব বাছুন (একাধিক বাছতে ট্যাপ করুন)।',
        '**Run DC sweep** চাপুন। কার্ভ আঁকা হবে; মান পড়তে গ্রাফ ছুঁন। **CSV** ডেটা এক্সপোর্ট করে।',
      ]),
      TIP('Try it: open **Diode I–V characteristic** and press Run DC sweep. Or in **Solar panel with load**, sweep the load resistance and measure power to find the maximum power point.',
        'চেষ্টা করুন: **Diode I–V characteristic** খুলে Run DC sweep চাপুন। অথবা **Solar panel with load**-এ লোড রেজিস্ট্যান্স সুইপ করে পাওয়ার মেপে ম্যাক্সিমাম পাওয়ার পয়েন্ট খুঁজুন।'),
      H('3. Operating Point', '৩. Operating Point'),
      P('A table of every **node voltage** and, for every component, its **voltage, current and power**. If the simulation is not running, you get the **DC operating point** (capacitors treated as open, inductors as short). If it is running, you get the values at the current moment. **Refresh** re-reads; **CSV** exports.',
        'প্রতিটি **নোড ভোল্টেজ** এবং প্রতিটি কম্পোনেন্টের **ভোল্টেজ, কারেন্ট ও পাওয়ার**-এর টেবিল। সিমুলেশন না চললে **DC operating point** পাবেন (ক্যাপাসিটর খোলা, ইন্ডাক্টর শর্ট ধরে)। চললে এখনকার মুহূর্তের মান পাবেন। **Refresh** আবার পড়ে; **CSV** এক্সপোর্ট করে।'),
      H('4. SPICE Netlist', '৪. SPICE Netlist'),
      P('Generates a standard SPICE netlist of your schematic, with `.op` and `.tran` commands, that you can open in **ngspice** or **LTspice** to cross-check results or continue research. Buttons: **Copy**, **Save .cir**, **Share**. Parts without a SPICE equivalent (such as digital blocks) are written as comments.',
        'আপনার স্কিমাটিকের স্ট্যান্ডার্ড SPICE নেটলিস্ট বানায়, `.op` ও `.tran` কমান্ডসহ, যা **ngspice** বা **LTspice**-এ খুলে ফল মিলিয়ে দেখা বা গবেষণা চালিয়ে যাওয়া যায়। বাটন: **Copy**, **Save .cir**, **Share**। যেসব পার্টের SPICE সমতুল্য নেই (যেমন ডিজিটাল ব্লক) সেগুলো কমেন্ট হিসেবে লেখা হয়।'),
    ],
  },

  // ------------------------------------------------------------------ 13
  {
    id: 'saving', icon: 'save',
    title: { en: 'Saving, opening and sharing', bn: 'সেভ, খোলা ও শেয়ার' },
    blocks: [
      H('Automatic saving', 'অটোমেটিক সেভ'),
      P('You never need to press Save. The circuit is saved a moment after every change, when you leave the editor, and when the app goes to the background. It then appears in **My Circuits** with a thumbnail. **Continue where you left off** on Home reopens the last circuit.',
        'আলাদা করে Save চাপতে হয় না। প্রতিটি পরিবর্তনের একটু পরে, এডিটর থেকে বের হলে এবং অ্যাপ ব্যাকগ্রাউন্ডে গেলে সার্কিট সেভ হয়। তারপর থাম্বনেইলসহ **My Circuits**-এ দেখা যায়। Home-এর **Continue where you left off** শেষ সার্কিট আবার খোলে।'),
      H('The ⋮ More menu in the editor', 'এডিটরের ⋮ More মেনু'),
      T([['Item', 'আইটেম'], ['What it does', 'কী করে']], [
        [['Save to My Circuits', 'Save to My Circuits'], ['Saves now.', 'এখনই সেভ করে।']],
        [['Save as copy', 'Save as copy'], ['Saves a second copy named "… (copy)" so you can try changes safely.', '"… (copy)" নামে দ্বিতীয় কপি সেভ করে, যাতে নিরাপদে পরিবর্তন পরীক্ষা করা যায়।']],
        [['Circuit name & notes', 'Circuit name & notes'], ['Change the name and add a note (up to 500 characters).', 'নাম বদলান ও নোট লিখুন (সর্বোচ্চ ৫০০ অক্ষর)।']],
        [['Export file (.rckt)', 'Export file (.rckt)'], ['Saves the circuit as a file you can keep or send.', 'সার্কিটকে ফাইল হিসেবে সেভ করে যা রাখা বা পাঠানো যায়।']],
        [['Open file…', 'Open file…'], ['Opens a `.rckt` circuit or a backup file.', '`.rckt` সার্কিট বা ব্যাকআপ ফাইল খোলে।']],
        [['Share circuit', 'Share circuit'], ['Sends the circuit through any app on your phone.', 'ফোনের যেকোনো অ্যাপের মাধ্যমে সার্কিট পাঠায়।']],
        [['SPICE netlist', 'SPICE netlist'], ['Opens Analysis on the netlist tab.', 'Analysis-এর নেটলিস্ট ট্যাব খোলে।']],
        [['Export image (PNG)', 'Export image (PNG)'], ['Saves a picture of the board with the circuit name and RAPTI credit, good for reports.', 'সার্কিটের নাম ও RAPTI ক্রেডিটসহ বোর্ডের ছবি সেভ করে, রিপোর্টের জন্য ভালো।']],
        [['Operating point', 'Operating point'], ['Opens Analysis on the operating-point tab.', 'Analysis-এর operating-point ট্যাব খোলে।']],
        [['Settings', 'Settings'], ['Opens Settings.', 'Settings খোলে।']],
        [['User manual', 'User manual'], ['Opens this manual.', 'এই ম্যানুয়াল খোলে।']],
        [['Help & gestures', 'Help & gestures'], ['Shows the short how-to card.', 'ছোট হাউ-টু কার্ড দেখায়।']],
        [['Clear circuit', 'Clear circuit'], ['Removes all parts, wires and probes after confirmation (Undo brings them back).', 'নিশ্চিত করার পর সব পার্ট, তার ও প্রোব সরায় (Undo দিলে ফিরে আসে)।']],
      ]),
      H('Backup and restore', 'ব্যাকআপ ও রিস্টোর'),
      L([
        '**Backup all** (My Circuits page or Settings → Backup circuits) saves **every** project and folder in one file named `RaptiCKT_backup_<date>.json`.',
        'To restore, tap **Import** or **Restore backup** and choose that file. The circuits are added back to My Circuits.',
        'Keep a backup before you change phones, clear app data or uninstall the app. **Uninstalling the app deletes your saved circuits.**',
      ], [
        '**Backup all** (My Circuits পেজ বা Settings → Backup circuits) **সব** সার্কিট `RaptiCKT_backup_<তারিখ>.json` নামের এক ফাইলে সেভ করে।',
        'রিস্টোর করতে **Import** বা **Restore backup** চেপে ওই ফাইল বাছুন। সার্কিটগুলো My Circuits-এ ফিরে আসবে।',
        'ফোন বদলানো, অ্যাপের ডেটা মোছা বা অ্যাপ আনইনস্টলের আগে ব্যাকআপ রাখুন। **অ্যাপ আনইনস্টল করলে সেভ করা সার্কিট মুছে যায়।**',
      ]),
      WARN('Storage is limited. If the app says "Storage is full", export some circuits as files and delete old ones.',
        'স্টোরেজ সীমিত। অ্যাপ "Storage is full" বললে কিছু সার্কিট ফাইল হিসেবে এক্সপোর্ট করে পুরনোগুলো মুছুন।'),
      H('Sending a circuit to a friend', 'বন্ধুকে সার্কিট পাঠানো'),
      S([
        'Open the circuit (or use its **⋮** menu in My Circuits).',
        'Choose **Share** and pick WhatsApp, Messenger, email or any app. Or choose **Export file** and send the `.rckt` file yourself.',
        'Your friend opens the file with **Open file** (or **Import**) in RaptiCKT. It is added to their My Circuits.',
      ], [
        'সার্কিট খুলুন (বা My Circuits-এ তার **⋮** মেনু ব্যবহার করুন)।',
        '**Share** বেছে WhatsApp, Messenger, ইমেইল বা যেকোনো অ্যাপ বাছুন। অথবা **Export file** করে `.rckt` ফাইল নিজে পাঠান।',
        'বন্ধু RaptiCKT-এর **Open file** (বা **Import**) দিয়ে ফাইল খুলবেন। এটা তাঁর My Circuits-এ যোগ হবে।',
      ]),
    ],
  },

  // ------------------------------------------------------------------ 14
  {
    id: 'settings', icon: 'sliders',
    title: { en: 'Settings reference', bn: 'সেটিংস রেফারেন্স' },
    blocks: [
      P('Open Settings from the sliders icon on Home or from **⋮ → Settings** in the editor. Every change is saved at once.',
        'Home-এর স্লাইডার আইকন বা এডিটরের **⋮ → Settings** থেকে Settings খুলুন। প্রতিটি পরিবর্তন সাথে সাথে সেভ হয়।'),
      H('Appearance', 'চেহারা'),
      T([['Setting', 'সেটিং'], ['What it does', 'কী করে']], [
        [['Theme', 'Theme'], ['**Midnight** (dark blue), **AMOLED Black** (pure black, saves battery on OLED screens) or **Blueprint Light** (for bright rooms and printing).', '**Midnight** (গাঢ় নীল), **AMOLED Black** (খাঁটি কালো, OLED স্ক্রিনে ব্যাটারি বাঁচায়) অথবা **Blueprint Light** (উজ্জ্বল ঘর ও প্রিন্টের জন্য)।']],
        [['Grid', 'Grid'], ['Lines, dots or none.', 'লাইন, ডট বা কিছু না।']],
        [['Voltage colours', 'Voltage colours'], ['Wires glow green (+) / red (−).', 'তার সবুজ (+) / লাল (−) জ্বলে।']],
        [['Current animation', 'Current animation'], ['Moving dots show current flow.', 'চলমান ডট কারেন্টের প্রবাহ দেখায়।']],
        [['Animation speed', 'Animation speed'], ['Slow, Normal, Fast, Very fast: how fast the current dots move (not the simulation).', 'ধীর, স্বাভাবিক, দ্রুত, খুব দ্রুত: কারেন্টের ডট কত দ্রুত চলবে (সিমুলেশন নয়)।']],
        [['Capacitor charge', 'Capacitor charge'], ['± signs on capacitor plates.', 'ক্যাপাসিটর প্লেটে ± চিহ্ন।']],
        [['Animations', 'Animations'], ['**Auto** (by phone speed), **Smooth** (always) or **Off** (simple and fastest). Use Off on a slow phone.', '**Auto** (ফোনের গতি অনুযায়ী), **Smooth** (সবসময়) অথবা **Off** (সহজ ও সবচেয়ে দ্রুত)। ধীর ফোনে Off ব্যবহার করুন।']],
        [['Value labels', 'Value labels'], ['Show component values (4.7 kΩ…) on the board.', 'বোর্ডে কম্পোনেন্টের মান (4.7 kΩ…) দেখায়।']],
        [['Component names', 'Component names'], ['Show R1, C1, D1…', 'R1, C1, D1… দেখায়।']],
        [['Live node voltages', 'Live node voltages'], ['Voltage of every net written on its wire.', 'প্রতিটি নেটের ভোল্টেজ তার ওপর লেখা।']],
        [['Live currents', 'Live currents'], ['Current and its direction beside each part.', 'প্রতিটি পার্টের পাশে কারেন্ট ও তার দিক।']],
        [['AC readings', 'AC readings'], ['**RMS** (like a meter) or **Instantaneous**.', '**RMS** (মিটারের মতো) অথবা **Instantaneous** (তাৎক্ষণিক)।']],
      ]),
      H('Simulation (for advanced users)', 'সিমুলেশন (অভিজ্ঞ ব্যবহারকারীদের জন্য)'),
      T([['Setting', 'সেটিং'], ['What it does', 'কী করে']], [
        [['Integration method', 'Integration method'], ['**Trapezoidal** (accurate, default) or **Backward Euler** (more damped, can calm a circuit that rings badly).', '**Trapezoidal** (নির্ভুল, ডিফল্ট) অথবা **Backward Euler** (বেশি ড্যাম্পড, খারাপভাবে দোলা সার্কিট শান্ত করতে পারে)।']],
        [['Start from DC operating point', 'Start from DC operating point'], ['On: the circuit starts in its settled DC state. Off: everything starts at zero, like switching on power.', 'চালু: সার্কিট স্থির DC অবস্থা থেকে শুরু হয়। বন্ধ: সব শূন্য থেকে শুরু, যেন পাওয়ার অন করা হলো।']],
        [['Maximum timestep', 'Maximum timestep'], ['Upper limit of the internal step (default 100 µs).', 'অভ্যন্তরীণ ধাপের সর্বোচ্চ সীমা (ডিফল্ট 100 µs)।']],
        [['RELTOL', 'RELTOL'], ['Relative tolerance, default 1e-3.', 'আপেক্ষিক সহনসীমা, ডিফল্ট 1e-3।']],
        [['VNTOL', 'VNTOL'], ['Absolute voltage tolerance, default 1 µV.', 'পরম ভোল্টেজ সহনসীমা, ডিফল্ট 1 µV।']],
        [['ABSTOL', 'ABSTOL'], ['Absolute current tolerance, default 1 nA.', 'পরম কারেন্ট সহনসীমা, ডিফল্ট 1 nA।']],
        [['GMIN', 'GMIN'], ['Tiny conductance from every node to ground that helps convergence, default 1e-12 S.', 'প্রতিটি নোড থেকে গ্রাউন্ডে ক্ষুদ্র কন্ডাক্টেন্স যা কনভার্জেন্সে সাহায্য করে, ডিফল্ট 1e-12 S।']],
        [['Newton iterations', 'Newton iterations'], ['Tries per step before the step is halved (default 60).', 'ধাপ অর্ধেক করার আগে প্রতি ধাপে কতবার চেষ্টা হবে (ডিফল্ট ৬০)।']],
      ]),
      P('These are the same defaults SPICE uses. Change them only if you know why; **Reset settings** restores everything.',
        'এগুলো SPICE-এর ডিফল্টের মতোই। কারণ জানলে তবেই বদলান; **Reset settings** সবকিছু আগের মতো করে দেয়।'),
      H('Interaction and data', 'ইন্টারঅ্যাকশন ও ডেটা'),
      T([['Setting', 'সেটিং'], ['What it does', 'কী করে']], [
        [['Haptic feedback', 'Haptic feedback'], ['Small vibrations when you add, wire, turn the knob or press a switch.', 'পার্ট যোগ, তার টানা, নব ঘোরানো বা সুইচ চাপার সময় হালকা ভাইব্রেশন।']],
        [['Sound (buzzer)', 'Sound (buzzer)'], ['Plays a tone when a buzzer, bell or speaker is active.', 'বাজার, বেল বা স্পিকার সক্রিয় থাকলে সুর বাজায়।']],
        [['Backup circuits', 'Backup circuits'], ['Saves every circuit in one file.', 'সব সার্কিট এক ফাইলে সেভ করে।']],
        [['Restore backup', 'Restore backup'], ['Loads a backup or circuit file.', 'ব্যাকআপ বা সার্কিট ফাইল লোড করে।']],
        [['Reset settings', 'Reset settings'], ['Back to defaults (your circuits are not touched).', 'ডিফল্টে ফেরে (আপনার সার্কিট ছোঁয়া হয় না)।']],
      ]),
    ],
  },

  // ------------------------------------------------------------------ 15 (library: generated)
  {
    id: 'library', icon: 'chip', generated: 'library',
    title: { en: 'Component library (all 335)', bn: 'কম্পোনেন্ট লাইব্রেরি (সবগুলো ৩৩৫টি)' },
    blocks: [
      P('Every component in the app, grouped as in the **+** menu. For each part you see what it does and which settings you can change. Use the search box at the top of the manual to find a part quickly.',
        'অ্যাপের প্রতিটি কম্পোনেন্ট, **+** মেনুর মতো গ্রুপ করে দেওয়া হলো। প্রতিটি পার্টের ক্ষেত্রে কী করে ও কোন সেটিং বদলানো যায় তা পাবেন। দ্রুত কোনো পার্ট খুঁজতে ম্যানুয়ালের উপরের সার্চ বক্স ব্যবহার করুন।'),
    ],
  },

  // ------------------------------------------------------------------ 16 (examples: generated)
  {
    id: 'examples', icon: 'book', generated: 'examples',
    title: { en: 'Examples (all 29)', bn: 'উদাহরণ (সবগুলো ২৯টি)' },
    blocks: [
      P('Open any example, press **Run** (it starts by itself), then experiment: tap switches, turn knobs, add scope probes, run an analysis. You cannot damage the original.',
        'যেকোনো উদাহরণ খুলুন, **Run** চাপুন (নিজেই শুরু হয়), তারপর পরীক্ষা করুন: সুইচ চাপুন, নব ঘোরান, স্কোপ প্রোব দিন, অ্যানালাইসিস চালান। মূল উদাহরণ নষ্ট হবে না।'),
    ],
  },

  // ------------------------------------------------------------------ 17
  {
    id: 'formulas', icon: 'sigma',
    title: { en: 'Quick reference: formulas and units', bn: 'দ্রুত রেফারেন্স: সূত্র ও একক' },
    blocks: [
      H('Ohm\'s law and power', 'ওহমের সূত্র ও পাওয়ার'),
      L(['`V = I × R`   ·   `P = V × I = I²R = V²/R`', 'Series: `R = R1 + R2 + …`   ·   Parallel: `1/R = 1/R1 + 1/R2 + …`', 'Voltage divider: `Vout = Vin × R2 / (R1 + R2)`'],
        ['`V = I × R`   ·   `P = V × I = I²R = V²/R`', 'সিরিজ: `R = R1 + R2 + …`   ·   প্যারালেল: `1/R = 1/R1 + 1/R2 + …`', 'ভোল্টেজ ডিভাইডার: `Vout = Vin × R2 / (R1 + R2)`']),
      H('Capacitors, inductors and time constants', 'ক্যাপাসিটর, ইন্ডাক্টর ও টাইম কনস্ট্যান্ট'),
      L(['RC time constant: `τ = R × C` (reaches 63 % in one τ, 99 % in 5 τ)', 'RL time constant: `τ = L / R`', 'Reactance: `Xc = 1 / (2πfC)`   ·   `Xl = 2πfL`', 'Cut-off of RC filter: `fc = 1 / (2πRC)`', 'Resonance of L and C: `f₀ = 1 / (2π√(LC))`   ·   Series RLC: `Q = (1/R)·√(L/C)`'],
        ['RC টাইম কনস্ট্যান্ট: `τ = R × C` (এক τ-তে ৬৩%, ৫ τ-তে ৯৯%)', 'RL টাইম কনস্ট্যান্ট: `τ = L / R`', 'রিয়্যাকট্যান্স: `Xc = 1 / (2πfC)`   ·   `Xl = 2πfL`', 'RC ফিল্টারের কাট-অফ: `fc = 1 / (2πRC)`', 'L ও C-এর রেজোন্যান্স: `f₀ = 1 / (2π√(LC))`   ·   সিরিজ RLC: `Q = (1/R)·√(L/C)`']),
      H('AC', 'AC'),
      L(['`Vrms = Vpeak / √2` (230 V RMS = 325 V peak)', 'Frequency and period: `f = 1 / T`', 'Power factor: `PF = cos φ = P / S`   ·   `S = V × I` (VA)   ·   `Q = V × I × sin φ` (VAR)', '3-phase: `V_line = √3 × V_phase`'],
        ['`Vrms = Vpeak / √2` (230 V RMS = 325 V পিক)', 'ফ্রিকোয়েন্সি ও পর্যায়কাল: `f = 1 / T`', 'পাওয়ার ফ্যাক্টর: `PF = cos φ = P / S`   ·   `S = V × I` (VA)   ·   `Q = V × I × sin φ` (VAR)', 'থ্রি-ফেজ: `V_line = √3 × V_phase`']),
      H('Semiconductors and ICs', 'সেমিকন্ডাক্টর ও আইসি'),
      L(['LED resistor: `R = (Vsupply − Vf) / I`', 'Inverting op-amp gain: `−Rf / Rin`   ·   Non-inverting: `1 + Rf / Rg`', '555 astable: `f = 1.44 / ((R1 + 2·R2) × C)`', 'Transformer: `Vs / Vp = Ns / Np`', 'Ripple of a rectifier with a capacitor: about `I / (f × C)`'],
        ['LED-এর রেজিস্টর: `R = (Vsupply − Vf) / I`', 'ইনভার্টিং অপ-অ্যাম্পের গেইন: `−Rf / Rin`   ·   নন-ইনভার্টিং: `1 + Rf / Rg`', '555 অ্যাস্টেবল: `f = 1.44 / ((R1 + 2·R2) × C)`', 'ট্রান্সফরমার: `Vs / Vp = Ns / Np`', 'ক্যাপাসিটরসহ রেকটিফায়ারের রিপল: প্রায় `I / (f × C)`']),
      H('Unit prefixes', 'একক প্রিফিক্স'),
      T([['Letter', 'অক্ষর'], ['Name and size', 'নাম ও মান']], [
        [['`p`', '`p`'], ['pico, 10⁻¹²', 'পিকো, 10⁻¹²']],
        [['`n`', '`n`'], ['nano, 10⁻⁹', 'ন্যানো, 10⁻⁹']],
        [['`u` or `µ`', '`u` বা `µ`'], ['micro, 10⁻⁶', 'মাইক্রো, 10⁻⁶']],
        [['`m`', '`m`'], ['milli, 10⁻³', 'মিলি, 10⁻³']],
        [['`k`', '`k`'], ['kilo, 10³', 'কিলো, 10³']],
        [['`M` or `meg`', '`M` বা `meg`'], ['mega, 10⁶', 'মেগা, 10⁶']],
        [['`G`', '`G`'], ['giga, 10⁹', 'গিগা, 10⁹']],
      ]),
      H('Colours used by the app', 'অ্যাপে ব্যবহৃত রং'),
      L(['Green = positive voltage · Red = negative voltage · Yellow dots = current.', 'Blue labels = voltages · Green labels = currents.', 'Scope: yellow, cyan, pink, green, orange, purple channels. Bode: yellow = gain, cyan dashed = phase.'],
        ['সবুজ = পজিটিভ ভোল্টেজ · লাল = নেগেটিভ ভোল্টেজ · হলুদ ডট = কারেন্ট।', 'নীল লেবেল = ভোল্টেজ · সবুজ লেবেল = কারেন্ট।', 'স্কোপ: হলুদ, সায়ান, গোলাপি, সবুজ, কমলা, বেগুনি চ্যানেল। Bode: হলুদ = গেইন, সায়ান ড্যাশ = ফেজ।']),
    ],
  },

  // ------------------------------------------------------------------ 18
  {
    id: 'troubleshooting', icon: 'help',
    title: { en: 'Troubleshooting and FAQ', bn: 'সমস্যা সমাধান ও প্রশ্নোত্তর' },
    blocks: [
      H('Nothing happens when I press Run', 'Run চাপলে কিছুই হয় না'),
      L(['The board may be empty: add components first.', 'The circuit may have no closed loop: current needs a path from the source, through the parts, and back.', 'The simulation may be **paused**: the button reads **Resume**.', 'The speed may be too slow or too fast for your circuit: tap the speed chip and tick **Automatic**.'],
        ['বোর্ড খালি থাকতে পারে: আগে কম্পোনেন্ট যোগ করুন।', 'সার্কিটে বদ্ধ লুপ না থাকতে পারে: কারেন্টের পথ লাগে, সোর্স থেকে পার্টের ভেতর দিয়ে আবার সোর্সে।', 'সিমুলেশন **পজ** করা থাকতে পারে: বাটনে **Resume** লেখা থাকবে।', 'গতি আপনার সার্কিটের জন্য খুব ধীর বা দ্রুত হতে পারে: গতির চিপে ট্যাপ করে **Automatic** টিক দিন।']),
      H('My LED / lamp does not light', 'LED / বাল্ব জ্বলছে না'),
      L(['Check polarity: the LED current must flow from anode to cathode. Use **Reverse polarity** in the quick bar.', 'Check that the wires touch the terminal circles. Zoom in to look.', 'Is a switch open? Tap it.', 'Is there enough voltage? An LED needs about 2 V plus a series resistor. A lamp needs its rated voltage.', 'Is a protective device tripped (MCB, fuse, RCCB)? Tap it to reset, or find the cause.'],
        ['পোলারিটি দেখুন: LED-এর কারেন্ট অ্যানোড থেকে ক্যাথোডে যেতে হবে। কুইক বারের **Reverse polarity** ব্যবহার করুন।', 'তার টার্মিনালের গোল ছুঁয়ে আছে কিনা দেখুন। জুম করে দেখুন।', 'কোনো সুইচ কি খোলা? ট্যাপ করুন।', 'ভোল্টেজ কি যথেষ্ট? LED-এর প্রায় 2 V ও সিরিজ রেজিস্টর লাগে। বাল্বের লাগে তার রেটেড ভোল্টেজ।', 'কোনো প্রটেক্টিভ ডিভাইস কি ট্রিপ করেছে (MCB, ফিউজ, RCCB)? ট্যাপ করে রিসেট করুন, বা কারণ খুঁজুন।']),
      H('"Circuit cannot be solved (singular matrix)"', '"Circuit cannot be solved (singular matrix)"'),
      L(['A **floating** part: something is connected to nothing, or a current source has no path. Connect it, or add a high resistor to ground.', 'A **loop of voltage sources or inductors** with no resistance. Add a small series resistor.', 'Two ideal voltage sources of different value connected in parallel. Add a little internal resistance (every source has an "Internal resistance" setting).', 'The message names the part: it is highlighted. Start there.'],
        ['**ঝুলে থাকা** অংশ: কিছু কোথাও যুক্ত নেই, বা কারেন্ট সোর্সের পথ নেই। জুড়ে দিন, অথবা গ্রাউন্ডের সাথে একটি বড় রেজিস্টর দিন।', 'রেজিস্ট্যান্সহীন **ভোল্টেজ সোর্স বা ইন্ডাক্টরের লুপ**। একটি ছোট সিরিজ রেজিস্টর দিন।', 'ভিন্ন মানের দুটি আইডিয়াল ভোল্টেজ সোর্স প্যারালেলে। একটু অভ্যন্তরীণ রেজিস্ট্যান্স দিন (প্রতিটি সোর্সে "Internal resistance" সেটিং আছে)।', 'মেসেজে পার্টের নাম থাকে ও সেটা হাইলাইট হয়। সেখান থেকে শুরু করুন।']),
      H('"Simulation failed to converge" / "did not converge"', '"Simulation failed to converge" / "did not converge"'),
      L(['Slow the simulation (smaller timestep) with the speed chip.', 'Check for very large or very small values (for example 1 TΩ next to 1 mΩ).', 'Add small series resistances to ideal switches, sources and inductors.', 'In **Settings**, try **Backward Euler**, or switch off **Start from DC operating point**.'],
        ['গতির চিপ দিয়ে সিমুলেশন ধীর করুন (ছোট টাইমস্টেপ)।', 'অতি বড় বা অতি ছোট মান আছে কিনা দেখুন (যেমন 1 mΩ-এর পাশে 1 TΩ)।', 'আইডিয়াল সুইচ, সোর্স ও ইন্ডাক্টরের সাথে ছোট সিরিজ রেজিস্ট্যান্স দিন।', '**Settings**-এ **Backward Euler** চেষ্টা করুন, অথবা **Start from DC operating point** বন্ধ করুন।']),
      H('"… is short-circuited"', '"… is short-circuited"'),
      P('A warning that both terminals of a part are on the same net. Remove the extra wire, unless you did it on purpose.',
        'ওয়ার্নিং: একটি পার্টের দুই প্রান্তই একই নেটে। ইচ্ছে করে না দিলে বাড়তি তারটি সরিয়ে দিন।'),
      H('The scope or meter shows nothing', 'স্কোপ বা মিটারে কিছু দেখাচ্ছে না'),
      L(['The simulation must be running.', 'Scope: you must add a probe first (select a wire, tap **Scope**). Up to 6 channels.', 'Meter: the probe pins must sit on a node (a wire or terminal). **Probe not on a node** means move the pin.', 'A or W mode needs a selected two-terminal part.'],
        ['সিমুলেশন চলা থাকতে হবে।', 'স্কোপ: আগে প্রোব দিতে হবে (তার সিলেক্ট করে **Scope** চাপুন)। সর্বোচ্চ ৬টি চ্যানেল।', 'মিটার: প্রোব পিন কোনো নোডে (তার বা টার্মিনালে) থাকতে হবে। **Probe not on a node** মানে পিন সরান।', 'A বা W মোডে একটি দুই-টার্মিনালের পার্ট সিলেক্ট করা থাকতে হবে।']),
      H('The Bode plot is empty or the button does nothing', 'Bode প্লট খালি, বা বাটন কিছু করছে না'),
      L(['Add a source and make sure it is chosen as **Input source**.', 'Probe the output wire with **Scope** so it appears under **Output**.', 'The stop frequency must be larger than the start frequency.'],
        ['একটি সোর্স দিন এবং **Input source**-এ সেটা বাছুন।', 'আউটপুটের তারে **Scope** দিয়ে প্রোব করুন, যাতে **Output**-এ আসে।', 'স্টপ ফ্রিকোয়েন্সি স্টার্টের চেয়ে বড় হতে হবে।']),
      H('"CPU-limited" or the app feels slow', '"CPU-limited" বা অ্যাপ ধীর লাগছে'),
      L(['Lower the **simulation speed**.', 'Settings → **Animations → Off**, and switch off **Live node voltages** and **Live currents**.', 'Close the scope panel and other apps. Very big circuits with many digital parts need more power.'],
        ['**সিমুলেশনের গতি** কমান।', 'Settings → **Animations → Off** করুন এবং **Live node voltages** ও **Live currents** বন্ধ করুন।', 'স্কোপ প্যানেল ও অন্য অ্যাপ বন্ধ করুন। অনেক ডিজিটাল পার্টওয়ালা বড় সার্কিটে বেশি ক্ষমতা লাগে।']),
      H('I cannot connect two parts', 'দুটি পার্ট জুড়তে পারছি না'),
      L(['Zoom in (pinch) so the terminals are bigger.', 'Tap exactly on the small circle: it lights up with a ring. A tap in the middle of a part selects the part instead.', 'Then tap the other terminal or a wire. Tapping empty space cancels.'],
        ['জুম ইন করুন (চিমটি) যাতে টার্মিনাল বড় হয়।', 'ছোট গোলের ঠিক ওপরে ট্যাপ করুন: চারপাশে রিংসহ জ্বলে উঠবে। পার্টের মাঝখানে ট্যাপ করলে পার্ট সিলেক্ট হয়।', 'তারপর অন্য টার্মিনালে বা তারে ট্যাপ করুন। ফাঁকা জায়গায় ট্যাপ করলে বাতিল হয়।']),
      H('I changed something by mistake', 'ভুল করে কিছু বদলে ফেলেছি'),
      P('Tap **Undo** (up to 120 steps). If you changed an example, open it again from Examples: the original is untouched.',
        '**Undo** চাপুন (১২০ ধাপ পর্যন্ত)। কোনো উদাহরণ বদলে ফেললে Examples থেকে আবার খুলুন: মূল উদাহরণ অক্ষত।'),
      H('My circuits disappeared', 'আমার সার্কিট হারিয়ে গেছে'),
      P('Circuits live inside the app on your phone. Clearing the app\'s data or uninstalling the app removes them. Restore from a backup file if you made one (**Open file / Restore backup**). Make backups regularly.',
        'সার্কিট আপনার ফোনে অ্যাপের ভেতরেই থাকে। অ্যাপের ডেটা মুছলে বা আনইনস্টল করলে সেগুলো চলে যায়। ব্যাকআপ ফাইল থাকলে সেখান থেকে ফেরান (**Open file / Restore backup**)। নিয়মিত ব্যাকআপ রাখুন।'),
      H('Can I use it without internet?', 'ইন্টারনেট ছাড়া ব্যবহার করা যায়?'),
      P('Yes. Only the buttons that open the RAPTI website, WhatsApp, email or map need internet.',
        'হ্যাঁ। শুধু RAPTI ওয়েবসাইট, WhatsApp, ইমেইল বা ম্যাপ খোলার বাটনে ইন্টারনেট লাগে।'),
      H('Is the result exactly like a real circuit?', 'ফল কি সত্যিকারের সার্কিটের মতোই হুবহু?'),
      P('The engine follows SPICE methods and has been checked against textbook answers (RC and RL time constants, resonance, diode, BJT and MOSFET equations, op-amp gain, transformer ratio, logic truth tables, 555 frequency and more). Blocks such as logic gates, the 555, regulators, sensors and protection devices are **idealised models**. Always confirm important designs with datasheets and real measurements, and use **SPICE netlist** to cross-check in ngspice or LTspice.',
        'ইঞ্জিন SPICE পদ্ধতি অনুসরণ করে এবং পাঠ্যবইয়ের উত্তরের সাথে মিলিয়ে দেখা হয়েছে (RC ও RL টাইম কনস্ট্যান্ট, রেজোন্যান্স, ডায়োড, BJT ও MOSFET সমীকরণ, অপ-অ্যাম্প গেইন, ট্রান্সফরমার অনুপাত, লজিক ট্রুথ টেবিল, 555 ফ্রিকোয়েন্সি ইত্যাদি)। লজিক গেট, 555, রেগুলেটর, সেন্সর ও প্রটেকশন ডিভাইসের মতো ব্লক **আদর্শায়িত মডেল**। গুরুত্বপূর্ণ ডিজাইন সবসময় ডেটাশিট ও বাস্তব মাপজোক দিয়ে যাচাই করুন, আর ngspice বা LTspice-এ মিলিয়ে দেখতে **SPICE netlist** ব্যবহার করুন।'),
    ],
  },

  // ------------------------------------------------------------------ 19
  {
    id: 'about', icon: 'star',
    title: { en: 'About RAPTI and contact', bn: 'RAPTI সম্পর্কে ও যোগাযোগ' },
    blocks: [
      P(`**${RAPTI.full}** (RAPTI) was established in ${RAPTI.founded}. ${RAPTI.mission} ${RAPTI.about}`,
        `**${RAPTI.full}** (RAPTI) ${RAPTI.founded} সালে প্রতিষ্ঠিত। লক্ষ্য: অটোমেশন শিল্পের জন্য দক্ষ জনশক্তি তৈরি করা। অভিজ্ঞ ও দক্ষ ইঞ্জিনিয়ারদের তৈরি কোর্সে শিক্ষার্থীরা এমন জ্ঞান ও দক্ষতা অর্জন করে যা চাকরির বাজারে সত্যিই দরকার।`),
      H('Courses', 'কোর্স'),
      L(RAPTI.courseList.map((c) => `${c.name} — ${c.months}`), RAPTI.courseList.map((c) => `${c.name} — ${c.months}`)),
      P('Tap a course on the **About** page to see what it covers and how long it takes.', '**About** পেজে কোনো কোর্সে ট্যাপ করলে সেটি কী নিয়ে এবং কতদিনের তা দেখা যায়।'),
      H('Contact', 'যোগাযোগ'),
      L([
        `Website: ${RAPTI.website.replace('https://', '')}`,
        `Phone / WhatsApp: ${RAPTI.phones.map((p) => p.replace(/^\+880/, '0').replace(/^(\d{5})(\d+)$/, '$1-$2')).join(', ')}`,
        `Email: ${RAPTI.email}`,
        `Address: ${RAPTI.address}`,
        'The **About** page in the app has one-tap buttons for all of these.',
      ], [
        `ওয়েবসাইট: ${RAPTI.website.replace('https://', '')}`,
        `ফোন / WhatsApp: ${RAPTI.phones.map((p) => p.replace(/^\+880/, '0').replace(/^(\d{5})(\d+)$/, '$1-$2')).join(', ')}`,
        `ইমেইল: ${RAPTI.email}`,
        `ঠিকানা: ${RAPTI.address}`,
        'অ্যাপের **About** পেজে এগুলোর প্রতিটির জন্য এক-ট্যাপের বাটন আছে।',
      ]),
    ],
  },
];

// ------------------------------------------------- per-category usage notes (library chapter)
export const CATEGORY_NOTES = {
  Sources: {
    en: 'Every circuit needs a source. **DC Voltage** is a battery-like source; **AC Voltage**, **Square**, **Pulse**, **Triangle**, **Sawtooth**, **Sweep**, **Noise**, **AM/FM**, **Step**, **Exponential**, **Damped sine**, **Piecewise-linear** and **f(t)** are signal generators for testing. **AC Mains** and the **3-phase** supplies are for power and house-wiring circuits (values are RMS). **Ground**, **Protective Earth** and **Chassis Ground** are all 0 V. The controlled sources (VCVS, VCCS, CCVS, CCCS) copy a measurement from one pair of terminals to another.',
    bn: 'প্রতিটি সার্কিটে একটি সোর্স লাগে। **DC Voltage** ব্যাটারির মতো সোর্স; **AC Voltage**, **Square**, **Pulse**, **Triangle**, **Sawtooth**, **Sweep**, **Noise**, **AM/FM**, **Step**, **Exponential**, **Damped sine**, **Piecewise-linear** ও **f(t)** পরীক্ষার সিগন্যাল জেনারেটর। **AC Mains** ও **3-phase** সাপ্লাই পাওয়ার ও হাউস-ওয়্যারিং সার্কিটের জন্য (মান RMS)। **Ground**, **Protective Earth** ও **Chassis Ground** সবই 0 V। কন্ট্রোলড সোর্স (VCVS, VCCS, CCVS, CCCS) এক জোড়া টার্মিনালের পরিমাপ অন্য জোড়ায় কপি করে।',
  },
  Batteries: {
    en: 'Each battery has a **state of charge** (%), a capacity (Ah) and an internal resistance. Its voltage falls as it discharges and a heavy load makes it sag. Current flowing into the + terminal charges it.',
    bn: 'প্রতিটি ব্যাটারির **চার্জের অবস্থা** (%), ক্ষমতা (Ah) ও অভ্যন্তরীণ রেজিস্ট্যান্স আছে। ডিসচার্জ হলে ভোল্টেজ কমে, ভারী লোডে ভোল্টেজ নেমে যায়। + টার্মিনালে ঢোকা কারেন্ট ব্যাটারি চার্জ করে।',
  },
  Passive: {
    en: 'Resistors, capacitors and inductors, plus variable and real-world versions. The knob changes the main value. Polarised capacitors (electrolytic, tantalum, supercapacitor) must be connected the right way round.',
    bn: 'রেজিস্টর, ক্যাপাসিটর ও ইন্ডাক্টর, সাথে ভেরিয়েবল ও বাস্তব সংস্করণ। নব মূল মান বদলায়। পোলারিটিযুক্ত ক্যাপাসিটর (ইলেক্ট্রোলাইটিক, ট্যান্টালাম, সুপারক্যাপাসিটর) সঠিক দিকে জুড়তে হবে।',
  },
  Transformers: {
    en: 'Coupled-coil models with a turns ratio. Use them for isolation and for stepping voltage up or down. The 3-phase transformers have standard vector groups (Dyn11, Yyn0, Yd1, Dd0). CT and PT are instrument transformers for metering.',
    bn: 'টার্ন রেশিওসহ কাপলড-কয়েল মডেল। আইসোলেশন এবং ভোল্টেজ বাড়ানো-কমানোর জন্য ব্যবহার করুন। থ্রি-ফেজ ট্রান্সফরমারে স্ট্যান্ডার্ড ভেক্টর গ্রুপ আছে (Dyn11, Yyn0, Yd1, Dd0)। CT ও PT মিটারিং-এর ইনস্ট্রুমেন্ট ট্রান্সফরমার।',
  },
  Protection: {
    en: 'Fuses, breakers, residual-current devices, surge protectors and relays. They really **trip** in the simulation (an MCB follows its B/C/D curve, an RCCB trips on leakage current). After a trip the part shows **TRIPPED** with the cause. Tap it once to reset.',
    bn: 'ফিউজ, ব্রেকার, রেসিডুয়াল-কারেন্ট ডিভাইস, সার্জ প্রটেক্টর ও রিলে। সিমুলেশনে এগুলো সত্যিই **ট্রিপ** করে (MCB তার B/C/D কার্ভ অনুসরণ করে, RCCB লিকেজ কারেন্টে ট্রিপ করে)। ট্রিপের পর পার্টে কারণসহ **TRIPPED** দেখায়। একবার ট্যাপ করলে রিসেট হয়।',
  },
  'Switches & Relays': {
    en: 'Tap a switch to toggle it while the circuit runs. Push buttons act only while held. Relays, contactors and timer relays have a **coil** side and a **contact** side: when the coil is energised the contacts move.',
    bn: 'সার্কিট চলার সময় সুইচে ট্যাপ করলে টগল হয়। পুশ বাটন কেবল চেপে ধরা অবস্থায় কাজ করে। রিলে, কন্টাক্টর ও টাইমার রিলের **কয়েল** ও **কন্টাক্ট** দুই দিক আছে: কয়েলে কারেন্ট এলে কন্টাক্ট নড়ে।',
  },
  Electrical: {
    en: 'Parts for house wiring and lighting: bulbs, tube light with choke and starter, fan with regulators, heater, socket with a selectable appliance (including "Faulty" and "Short circuit" for testing protection), dimmer, bell and earth electrode. Use them with **AC Mains**.',
    bn: 'হাউস ওয়্যারিং ও আলোর যন্ত্রাংশ: বাল্ব, চোক ও স্টার্টারসহ টিউবলাইট, রেগুলেটরসহ ফ্যান, হিটার, বেছে নেওয়া যায় এমন যন্ত্রসহ সকেট (প্রটেকশন পরীক্ষার জন্য "Faulty" ও "Short circuit" সহ), ডিমার, বেল ও আর্থ ইলেকট্রোড। **AC Mains**-এর সাথে ব্যবহার করুন।',
  },
  'Power Systems': {
    en: 'Rated loads (R-L, R-C, 3-phase star and delta), a power-factor correction capacitor and transmission-line models. Set the load by its power and power factor.',
    bn: 'রেটেড লোড (R-L, R-C, থ্রি-ফেজ স্টার ও ডেল্টা), পাওয়ার-ফ্যাক্টর কারেকশন ক্যাপাসিটর ও ট্রান্সমিশন-লাইন মডেল। পাওয়ার ও পাওয়ার ফ্যাক্টর দিয়ে লোড ঠিক করুন।',
  },
  Machines: {
    en: 'DC motors and generators, single- and 3-phase induction motors and an alternator. They include electrical and mechanical behaviour: starting current, speed and torque. Read the live **rpm** and **current** in the properties sheet.',
    bn: 'DC মোটর ও জেনারেটর, সিঙ্গেল ও থ্রি-ফেজ ইনডাকশন মোটর এবং অল্টারনেটর। এতে বৈদ্যুতিক ও যান্ত্রিক আচরণ আছে: স্টার্টিং কারেন্ট, গতি ও টর্ক। প্রপার্টিজ শিটে লাইভ **rpm** ও **current** দেখুন।',
  },
  Diodes: {
    en: 'Diodes conduct only one way (anode → cathode). Zener diodes hold a fixed reverse voltage. Bridge and 3-phase rectifiers are ready-made blocks. Pick a **model** to get real-part numbers.',
    bn: 'ডায়োড শুধু এক দিকে (অ্যানোড → ক্যাথোড) কারেন্ট চালায়। জেনার ডায়োড নির্দিষ্ট রিভার্স ভোল্টেজ ধরে রাখে। ব্রিজ ও থ্রি-ফেজ রেকটিফায়ার তৈরি ব্লক। বাস্তব পার্টের সংখ্যা পেতে **model** বাছুন।',
  },
  Transistors: {
    en: 'BJTs, MOSFETs, JFETs, IGBT and more. Terminals: BJT = collector, base, emitter; MOSFET = drain, gate, source. Pick a **model** (2N3904, 2N2222, BC547, 2N7000, IRF540N…) for real numbers.',
    bn: 'BJT, MOSFET, JFET, IGBT ইত্যাদি। টার্মিনাল: BJT = কালেক্টর, বেজ, এমিটার; MOSFET = ড্রেন, গেট, সোর্স। বাস্তব সংখ্যার জন্য **model** (2N3904, 2N2222, BC547, 2N7000, IRF540N…) বাছুন।',
  },
  'Thyristors & Power': {
    en: 'SCR, TRIAC, DIAC, GTO and friends for phase control and power switching, plus gate drivers and buck/boost converter modules.',
    bn: 'ফেজ কন্ট্রোল ও পাওয়ার সুইচিংয়ের জন্য SCR, TRIAC, DIAC, GTO ইত্যাদি, সাথে গেট ড্রাইভার ও বাক/বুস্ট কনভার্টার মডিউল।',
  },
  'Analog ICs': {
    en: 'Op-amps (with gain-bandwidth and slew rate), comparators, the 555 timer, fixed and adjustable regulators and other analog building blocks. Real op-amp models: LM741, LM358, TL071 and more.',
    bn: 'অপ-অ্যাম্প (গেইন-ব্যান্ডউইথ ও স্লিউ রেটসহ), কম্পারেটর, 555 টাইমার, ফিক্সড ও অ্যাডজাস্টেবল রেগুলেটর এবং অন্যান্য অ্যানালগ বিল্ডিং ব্লক। বাস্তব অপ-অ্যাম্প মডেল: LM741, LM358, TL071 ইত্যাদি।',
  },
  'Control & Math': {
    en: 'Signal-flow blocks, as in Simulink: gain, adders, multiplier, integrator, differentiator, transfer functions, PID, limiter, delay and mathematical functions. They work on voltages standing for signals.',
    bn: 'সিগন্যাল-ফ্লো ব্লক, Simulink-এর মতো: গেইন, অ্যাডার, মাল্টিপ্লায়ার, ইন্টিগ্রেটর, ডিফারেনশিয়েটর, ট্রান্সফার ফাংশন, PID, লিমিটার, ডিলে ও গাণিতিক ফাংশন। এগুলো সিগন্যালের প্রতিনিধি ভোল্টেজের ওপর কাজ করে।',
  },
  'Logic Gates': {
    en: 'Inputs, outputs and gates. **Logic input** is a switch you tap (HIGH/LOW); **Clock** gives a square wave; **Logic output** is an indicator that shows 1 (lit) or 0. Gates give outputs from the logic levels at their inputs.',
    bn: 'ইনপুট, আউটপুট ও গেট। **Logic input** ট্যাপ করার সুইচ (HIGH/LOW); **Clock** স্কয়ার ওয়েভ দেয়; **Logic output** সূচক যা 1 (জ্বলা) বা 0 দেখায়। গেট ইনপুটের লজিক লেভেল থেকে আউটপুট দেয়।',
  },
  'Digital ICs': {
    en: 'Adders, comparators, multiplexers, decoders, latches, flip-flops, counters, shift registers, monostable, ADC and DAC. Drive them with a **Clock** and **Logic inputs**, and watch with **Logic output** or a 7-segment display.',
    bn: 'অ্যাডার, কম্পারেটর, মাল্টিপ্লেক্সার, ডিকোডার, ল্যাচ, ফ্লিপ-ফ্লপ, কাউন্টার, শিফট রেজিস্টার, মনোস্টেবল, ADC ও DAC। **Clock** ও **Logic input** দিয়ে চালান, আর **Logic output** বা 7-সেগমেন্ট ডিসপ্লেতে দেখুন।',
  },
  Sensors: {
    en: 'Each sensor has an **environment knob**: light for an LDR, temperature for an NTC or LM35, strain for a strain gauge, field for a Hall sensor, and so on. Turn it while running to see the sensor respond. Tap a PIR to simulate motion.',
    bn: 'প্রতিটি সেন্সরে একটি **পরিবেশের নব** আছে: LDR-এর জন্য আলো, NTC বা LM35-এর জন্য তাপমাত্রা, স্ট্রেন গেজের জন্য স্ট্রেন, হল সেন্সরের জন্য ফিল্ড ইত্যাদি। চলার সময় ঘোরালে সেন্সরের সাড়া দেখা যায়। PIR-এ ট্যাপ করলে "নড়াচড়া" ঘটে।',
  },
  Output: {
    en: 'LEDs (single, RGB, bicolour, infrared, laser), a bar graph, 7-segment and hex displays, buzzers, speaker, solenoid and servo. They light, sound or move to show what the circuit is doing.',
    bn: 'LED (সিঙ্গেল, RGB, বাইকালার, ইনফ্রারেড, লেজার), বার গ্রাফ, 7-সেগমেন্ট ও হেক্স ডিসপ্লে, বাজার, স্পিকার, সোলেনয়েড ও সার্ভো। সার্কিট কী করছে তা দেখাতে এগুলো জ্বলে, বাজে বা নড়ে।',
  },
  'Vacuum Tubes': {
    en: 'Classic valves: vacuum diode, triode and pentode, for vintage audio and radio circuits.',
    bn: 'ক্লাসিক ভালভ: ভ্যাকুয়াম ডায়োড, ট্রায়োড ও পেন্টোড, পুরনো অডিও ও রেডিও সার্কিটের জন্য।',
  },
  Meters: {
    en: 'Meters that stay in the circuit: voltmeter, ammeter (use **Auto** for RMS in AC), ohmmeter, wattmeter, power-factor, VAR, kWh, frequency, phase, dB, peak, LCR, megger and moving-coil meters. **Test point** and **Label** mark and name places on the schematic.',
    bn: 'যে মিটার সার্কিটেই থাকে: ভোল্টমিটার, অ্যামমিটার (AC-তে RMS-এর জন্য **Auto**), ওহমমিটার, ওয়াটমিটার, পাওয়ার-ফ্যাক্টর, VAR, kWh, ফ্রিকোয়েন্সি, ফেজ, dB, পিক, LCR, মেগার ও মুভিং-কয়েল মিটার। **Test point** ও **Label** স্কিমাটিকে জায়গা চিহ্নিত ও নাম দেয়।',
  },
};

// One-line description of each chapter, shown on the manual's contents page.
export const SUMMARY = {
  welcome: { en: 'What the app does and who it is for', bn: 'অ্যাপ কী করে ও কাদের জন্য' },
  quickstart: { en: 'Build and run your first circuit in 2 minutes', bn: '২ মিনিটে প্রথম সার্কিট বানান ও চালান' },
  screens: { en: 'The main pages and how to move between them', bn: 'মূল পেজগুলো ও এক পেজ থেকে অন্য পেজে যাওয়া' },
  editor: { en: 'Top bar, toolbar, board and gestures', bn: 'টপ বার, টুলবার, বোর্ড ও জেসচার' },
  adding: { en: 'Find components and place them on the board', bn: 'কম্পোনেন্ট খুঁজে বোর্ডে বসানো' },
  editing: { en: 'Select, move, rotate, copy, undo', bn: 'সিলেক্ট, সরানো, ঘোরানো, কপি, Undo' },
  wiring: { en: 'Draw wires, junctions and ground', bn: 'তার আঁকা, জংশন ও গ্রাউন্ড' },
  values: { en: 'Type values, sliders and the knob', bn: 'মান টাইপ করা, স্লাইডার ও নব' },
  running: { en: 'Run, pause, speed, live colours, errors', bn: 'Run, Pause, গতি, লাইভ রং, এরর' },
  scope: { en: '6 channels, FFT and XY views', bn: '৬ চ্যানেল, FFT ও XY ভিউ' },
  meter: { en: 'Voltage, current, resistance and power', bn: 'ভোল্টেজ, কারেন্ট, রেজিস্ট্যান্স ও পাওয়ার' },
  analysis: { en: 'AC sweep, DC sweep, operating point, SPICE', bn: 'AC sweep, DC sweep, operating point, SPICE' },
  saving: { en: 'Autosave, files, sharing and backup', bn: 'অটোসেভ, ফাইল, শেয়ার ও ব্যাকআপ' },
  settings: { en: 'Every setting explained', bn: 'প্রতিটি সেটিং ব্যাখ্যাসহ' },
  library: { en: 'All components, category by category', bn: 'ক্যাটাগরি ধরে ধরে সব কম্পোনেন্ট' },
  examples: { en: 'Ready-made circuits to learn from', bn: 'শেখার জন্য তৈরি সার্কিট' },
  formulas: { en: 'Formulas, unit prefixes and colours', bn: 'সূত্র, একক প্রিফিক্স ও রং' },
  troubleshooting: { en: 'Fixes for common problems, FAQ', bn: 'সাধারণ সমস্যার সমাধান, প্রশ্নোত্তর' },
  about: { en: 'RAPTI courses and contact', bn: 'RAPTI-র কোর্স ও যোগাযোগ' },
};

/**
 * A chapter split into pages: the text before its first sub-heading, then one
 * section per sub-heading. A chapter with fewer than two sections stays on one page.
 */
export function chapterParts(c) {
  const intro = [], sections = [];
  for (const b of c.blocks) {
    if (b.t === 'h') sections.push({ title: { en: b.en, bn: b.bn }, blocks: [] });
    else (sections.length ? sections[sections.length - 1].blocks : intro).push(b);
  }
  return sections.length >= 2 ? { intro, sections } : { intro: c.blocks, sections: [] };
}

// ---------------------------------------------------------------- chapter references
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export const digits = (n, lang) => (lang === 'bn' ? String(n).replace(/\d/g, (d) => BN_DIGITS[d]) : String(n));
export const chapterNumber = (id) => CHAPTERS.findIndex((c) => c.id === id) + 1;
/** "chapter 9" / "অধ্যায় ৯" */
export const chapterLabel = (id, lang) => `${lang === 'bn' ? 'অধ্যায়' : 'chapter'} ${digits(chapterNumber(id), lang)}`;
/** Replace {{ch:id}} tokens; link(id, label) may wrap the label (e.g. in an <a>). */
export function expandRefs(text, lang, link = (id, label) => label) {
  return String(text).replace(/\{\{ch:([a-z]+)\}\}/g, (m, id) => (chapterNumber(id) ? link(id, chapterLabel(id, lang)) : ''));
}

// ------------------------------------------------------------ catalogue builders
const strip = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** The component library as data: [{id, note, items:[{title, desc, props}]}], read live from the registry. */
export function libraryData() {
  return CATEGORIES.map((c) => ({
    id: c.id,
    note: CATEGORY_NOTES[c.id],
    items: c.items.map((t) => getType(t)).filter(Boolean).map((C) => ({
      type: C.type,
      title: C.title,
      desc: strip(C.description),
      props: (C.props || []).filter((p) => !p.hidden).map((p) => p.label + (p.unit ? ` (${p.unit})` : '')),
    })),
  }));
}

export function libraryCount() { return libraryData().reduce((n, c) => n + c.items.length, 0); }

/** The examples as data, grouped by category in the order they appear in the app. */
export function exampleData() {
  const cats = [];
  for (const e of EXAMPLES) {
    let c = cats.find((x) => x.id === e.cat);
    if (!c) { c = { id: e.cat, items: [] }; cats.push(c); }
    c.items.push({ id: e.id, title: e.title, desc: strip(e.desc) });
  }
  return cats;
}

// ------------------------------------------------------------------ markdown export
let mdLang = 'en';
function mdInline(s) { return expandRefs(s, mdLang); }
const cell = (s) => mdInline(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function blockMd(b, lang) {
  switch (b.t) {
    case 'p': return `${mdInline(b[lang])}\n`;
    case 'h': return `#### ${mdInline(b[lang])}\n`;
    case 'steps': return `${b[lang].map((x, i) => `${i + 1}. ${mdInline(x)}`).join('\n')}\n`;
    case 'ul': return `${b[lang].map((x) => `- ${mdInline(x)}`).join('\n')}\n`;
    case 'tip': return `> **${lang === 'bn' ? 'টিপ' : 'Tip'}:** ${mdInline(b[lang])}\n`;
    case 'warn': return `> **${lang === 'bn' ? 'সতর্কতা' : 'Warning'}:** ${mdInline(b[lang])}\n`;
    case 'table': {
      const n = b.head.length, i = lang === 'bn' ? 1 : 0;
      const head = `| ${b.head.map((h) => cell(h[i])).join(' | ')} |\n| ${Array(n).fill('---').join(' | ')} |`;
      const rows = b.rows.map((r) => `| ${r.map((c) => cell(c[i])).join(' | ')} |`).join('\n');
      return `${head}\n${rows}\n`;
    }
    default: return '';
  }
}

/** The whole manual as Markdown in one language. */
export function manualMarkdown(lang = 'en') {
  mdLang = lang;
  const L2 = (o) => o[lang];
  const out = [];
  out.push(`# RaptiCKT — ${L2(UI_TEXT.title)}`, '', `*${APP.tagline} · ${APP.subtitle} · ${L2(UI_TEXT.version)} ${APP.version}*`, '', `${L2(UI_TEXT.tagline)}`, '');
  out.push(`## ${L2(UI_TEXT.contents)}`, '');
  CHAPTERS.forEach((c, i) => out.push(`${i + 1}. [${L2(c.title)}](#${lang}-ch-${c.id})`));
  out.push('');
  CHAPTERS.forEach((c, i) => {
    out.push(`<a id="${lang}-ch-${c.id}"></a>`, '', `## ${i + 1}. ${L2(c.title)}`, '');
    for (const b of c.blocks) out.push(blockMd(b, lang));
    if (c.generated === 'library') {
      out.push(`*${L2(UI_TEXT.note)}*`, '');
      for (const cat of libraryData()) {
        out.push(`### ${cat.id} (${cat.items.length})`, '');
        if (cat.note) out.push(cat.note[lang], '');
        out.push('| | |', '| --- | --- |');
        for (const it of cat.items) out.push(`| **${cell(it.title)}** | ${cell(it.desc)}${it.props.length ? ` <br>*${L2(UI_TEXT.props)}:* ${cell(it.props.join(', '))}` : ''} |`);
        out.push('');
      }
    }
    if (c.generated === 'examples') {
      for (const cat of exampleData()) {
        out.push(`### ${cat.id}`, '');
        for (const it of cat.items) out.push(`- **${it.title}**: ${it.desc}`);
        out.push('');
      }
    }
  });
  out.push('---', `© ${new Date().getFullYear()} ${RAPTI.full} · rapti.net`, '');
  return out.join('\n');
}
