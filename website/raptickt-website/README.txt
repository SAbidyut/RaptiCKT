=====================================================================
 RaptiCKT website (PHP)  /  RaptiCKT ওয়েবসাইট (PHP)
=====================================================================

কী আছে / What is inside
  index.php        হোম পেজ            Home
  features.php     ফিচার              Features
  components.php   ৫২০টি কম্পোনেন্ট (সার্চসহ)   All 520 parts, searchable
  examples.php     ১০১টি উদাহরণ (ছবিসহ, ক্লিক করলে সিমুলেটরে খোলে)
  manual.php       ইউজার ম্যানুয়াল (২০টি অধ্যায়)
  download.php     APK / ব্রাউজারে চালানো
  about.php        RAPTI পরিচিতি
  contact.php      যোগাযোগ ফর্ম (বার্তা storage/messages.log ফাইলে জমা হয়)
  simulator/       পুরো সার্কিট সিমুলেটর — ব্রাউজারেই চলে (PHP লাগে না)
  includes/config.php   <-- নাম, ফোন, ইমেইল, APK লিংক এখানে বদলান
  assets/          CSS, JS, ছবি

ভাষা: ওয়েবসাইটের উপরে ডানে "বাংলা / EN" বাটনে ইংরেজি ও বাংলা বদলানো যায়।
(ম্যানুয়াল শুধু ইংরেজিতে।)


কীভাবে পিসিতে চালাবেন / How to run on your PC
---------------------------------------------------------------------
পদ্ধতি ১ — XAMPP (সবচেয়ে সহজ, Windows)
  1. https://www.apachefriends.org থেকে XAMPP ইনস্টল করুন।
  2. এই পুরো "raptickt-website" ফোল্ডারটি কপি করে C:\xampp\htdocs\ এর ভেতরে রাখুন।
  3. XAMPP Control Panel খুলে Apache-এর পাশে "Start" চাপুন।
  4. ব্রাউজারে যান:  http://localhost/raptickt-website/

পদ্ধতি ২ — ডাবল-ক্লিক (PHP ইনস্টল থাকলে)
  Windows : START-SERVER.bat এ ডাবল-ক্লিক করুন (XAMPP থাকলে নিজে PHP খুঁজে নেবে)।
  Linux/Mac: টার্মিনালে  ./start-server.sh
  ব্রাউজার নিজে থেকে http://localhost:8000/ খুলবে।

পদ্ধতি ৩ — টার্মিনাল
  cd raptickt-website
  php -S localhost:8000 router.php

শুধু সিমুলেটর চালাতে PHP লাগে না: simulator/index.html ব্রাউজারে খুললেই চলে।

অনলাইনে দিতে (cPanel / হোস্টিং)
  পুরো ফোল্ডারের ভেতরের ফাইলগুলো public_html এ আপলোড করুন (PHP 7.4 বা নতুন)।
  storage/ ফোল্ডারটি লেখার অনুমতি (writable) দিন, নইলে যোগাযোগ ফর্ম বার্তা রাখতে পারবে না।
  ইমেইলেও বার্তা পেতে includes/config.php তে CONTACT_MAIL কে true করুন।
  APK আপলোড করলে config.php এর APK_URL এ তার লিংক দিন।


পিসিতে মাউস দিয়ে কী কী করা যায় / Mouse on PC
---------------------------------------------------------------------
  * বাম বাটন ড্র্যাগ     — পার্ট সরান (Wire মোডে), খালি জায়গায় ড্র্যাগ করলে বোর্ড প্যান
  * ডান / মিডল বাটন ড্র্যাগ — যেকোনো অবস্থায় বোর্ড প্যান
  * মাউস হুইল            — জুম ইন / আউট
  * লিস্ট, কার্ড-রো, ট্যাব, সেটিংস, ম্যানুয়াল পেজ — বাটন চেপে ধরে ড্র্যাগ করে স্ক্রল (ফোনের মতো)
  * নব (ঘূর্ণি বাটন)      — ড্র্যাগ করে বা হুইল ঘুরিয়ে মান বদলান
  * কিবোর্ড: Space = Run/Pause, R = ঘোরান, Delete = মুছুন, Ctrl+Z / Ctrl+Y = undo/redo,
              Ctrl+D = কপি, O = Operate মোড, W = Wire মোড
  * ওয়েবসাইটের স্ক্রিনশট স্ট্রিপ ও ক্যাটাগরি চিপও মাউস দিয়ে টেনে সরানো যায়।


ওয়েবসাইট আবার তৈরি করতে (ডেভেলপার) / Rebuilding
---------------------------------------------------------------------
  সোর্স রিপোজিটরির ভেতর থেকে:  ./website/build-site.sh
  (Node.js, Python + Pillow, zip লাগে। এটি সিমুলেটর build করে, উদাহরণের ছবি বানায়, ম্যানুয়াল কপি করে এবং
   website/raptickt-website.zip তৈরি করে।)

RAPTI — Resonance Automation Professional Training Institute · rapti.net
