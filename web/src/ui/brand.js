// Branding and organisation information (sourced from rapti.net).

export const APP = {
  name: 'RaptiCKT',
  tagline: 'Resonance Automation',
  subtitle: 'Circuit Simulator',
  slogan: 'Design. Simulate. Resonate.',
  version: '1.0.0',
};

export const RAPTI = {
  name: 'RAPTI',
  full: 'Resonance Automation Professional Training Institute',
  founded: 2019,
  mission: 'Established in 2019 with one goal: developing skilled manpower for the automation industry.',
  about: 'Courses at RAPTI are designed by experienced, competent engineers so that every student can work independently in any industry after completing a course — with the knowledge and skills that real job positions demand.',
  // from rapti.net/app-course.php
  courseList: [
    { name: 'Industrial Automation (PLC)', cat: 'Electrical', months: '3 Months', about: 'The complete industrial automation package — hands-on training on 5+ PLC brands (Siemens, Mitsubishi, Delta, LS), HMI, VFD, servo drives and process instrumentation.' },
    { name: 'Industrial Electrical Control', cat: 'Electrical', months: '3 Months', about: 'Magnetic contactors, timers, sensors, ATS, star-delta — everything inside an industrial control panel, taught hands-on.' },
    { name: 'General Electrician', cat: 'Electrical', months: '3 Months', about: 'Everything in House Wiring plus motor rewinding, DOL & star-delta starters, IPS / solar / generator systems and transformers — the complete electrician course.' },
    { name: 'House Wiring', cat: 'Electrical', months: '3 Months', about: 'From safety to complete residential wiring, earthing and motors — 14 modules of fully hands-on training, including 15 practical wiring circuits.' },
    { name: 'CC Camera', cat: 'Electrical', months: '15 Days', about: 'Master the complete setup, wiring, configuration, and maintenance of modern security surveillance systems!' },
    { name: 'Computer Office Application', cat: 'Computer', months: '3 Months', about: 'From computer basics to Word, Excel, PowerPoint, Access and email — the complete office skill set.' },
    { name: 'Graphic Design & Multimedia', cat: 'Computer', months: '3 Months', about: 'Photoshop and Illustrator with a real project in every module. Finish with a portfolio — logo, business card, posters — plus a freelancing guide.' },
    { name: 'Web Design & Development', cat: 'Computer', months: '3 Months', about: 'HTML, CSS, responsive design and Bootstrap through PHP CRUD — a hands-on project at every step.' },
    { name: 'App Development', cat: 'Computer', months: '3 Months', about: 'Build Android apps with Java and Android Studio, earn with AdMob, and publish to the Play Store — A to Z.' },
  ],

  address: '2101, Bhuighar, Rupayan Town, Near Gate-1, Fatullah, Narayanganj - 1420, Bangladesh',
  city: 'Fatullah, Narayanganj',
  phones: ['+8801617345534', '+8801685953204', '+8801766221733'],
  whatsapp: '+8801617345534',
  email: 'raptibd@gmail.com',
  website: 'https://rapti.net',
  coursesUrl: 'https://rapti.net/app-course.php',
  mapsUrl: 'https://maps.google.com/?q=Rupayan+Town+Bhuighar+Fatullah+Narayanganj+1420',
};

RAPTI.courses = RAPTI.courseList.map((c) => c.name);
