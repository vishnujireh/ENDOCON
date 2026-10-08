import {
  CommitteeMember,
  Speaker,
  ProgramDay,
  PricingTier,
  Attraction,
  ConferenceRegistrationCategory,
  AccommodationOption,
} from '../types';
import endoscopyHero1 from '../assets/images/medical_endoscopy_hero_1788839185745.jpg';
import endoscopyHero2 from '../assets/images/endoscopy_procedure_monitor_1788839206124.jpg';
import catalogueFile from '@shared/catalogue.json';
import anil from '../../public/anil-arora.webp';
import manoj from '../../public/manoj-k.webp';
import ajay from '../../public/ajay-k.webp';
import malay from '../../public/malay-sharma.webp';
import praveer from '../../public/praveer-rai.webp';
import amitabh from '../../public/amitabh.webp';


export const CONFERENCE_IMAGES = {
  hero: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDUyLi6mhy_JMEX10rCXGYixcY2FnqHLT14tjOrhGckvN_YbP8I_-tYgoJ9bAYlIcfCw26IZuu8Bd8aIqfrdHzD7ZVSir0KPeo8X6bphDHNP-zATkDqb883UjKefZAiD9V7meQTfgp3e2eMRPdxLuBOwTOvuM0GRV48h9XwxBvVHdhFF7KkJNWVCwFhpFnVEnr6FqKzddO-ycTBvpnhqnhVmawh0fQY4Ergbb8VSwpLiWbqV4Juegan0w',
  endoscopyTheater: endoscopyHero1,
  endoscopyMonitor: endoscopyHero2,
  alokSharma: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAonZ9vHeIQObg8KdlPxmNT2ns67teOrm1XwsyLD9qENWXWSm95gyM3fmDJSo5U5dPa9YBQ_Hb-YmovQH2ISGwCd2j0QKPBn8k3YgUjfx4t8p5pxpYtzDmO0EwKEU56-dGtPpW66ub5Fu2ycCtdv-EZoAOqKNxsbnuNuJjCg_4W32o5yQA7YDrwH052IXfVMhc7OAKquFPlLuD8fwnqJN1OHWtnhq-nk-AZoK_d9qGnyS7rlOIhRKMW3g',
  sunitaDas: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHFn04jvTo_JKZ49TOIbEZgIlIgby437Oo1qf2h76gDMUmytewaOeBxTN5t5cA6W4ElAj5s2oFMorhW07KHuGa_fdN6Yv-zD76f7o4C1dcKBMVBHP9W6bgy0DZo5c-p-TiNWBDOZcR6GWF7ImijMAAaKf4SJbDl82s6o49o-kby76F5XNIEjyUXMv64nY3dYnU7RdyGeP1KNxDh5TeIWl562vE70mES0f4wpBGyMuhLiKbDKZWe1MmEg',
  rajivMenon: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCcyc2DctTxLwPJP8kIHgZ0142r0WR4hZ8jqeiCnPKPPrhhkCDMSrzI48ORzQdD7Avs_FHZ-jrqAE2gxgcMJMMYktXZ-R7TNHYzKTi_tDatd_9rkkL2JElDyhzrV1y20zlHMYHKhb5CR8ZlUFxUeSgvXlpe9FOo1jz8vp71zVtdxlUK59sOV6jPyFU0rwd8YBqWrS1YWg6MCcL7JaRrapG07uuJCLpMJP4ESMmSl7-Rk9Dk6or1VG28GA',
  victoriaMemorial: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB3R0TkD4bubNoEEnpF0ZbiAl1tcsuvSyqkyQgQlJ4szfL7-oQCLB5a1bwUi6MR0x6dhDa-sXdMWzwWKNUXhCG4Uqfl4i6JGVL9bYVrUfDA5qq8yU4rn6dRvaG_Ho6i7k9ldPZZS5oYmYVSsxb45YSp_WJBibVl0fL0qhWf_WHLtiKaqSvkXm7wP6ufRLsriL9-8swv-k9Ye-HMFw7iO9q7qifsKGhRWJ7jM3sjVvH4iCQ0P2_iEbX8JA',
  howrahBridge: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBpml7lKf4jkbhu6ugM5CHWoy5Ho0tVqkyz5U3IX_RijY30lJDH-Qlhe-Xd48lpEQ4yrG_8-kd5R47P1eFKdf_TO5c8kpvPaRMPa_ZYFP8KBkkE6m2NrCQ9OTov8ehiTuQLjMTXP9Y5iqz1CmdYXC75mdWDEfbcKrCEeb3dRU9N9bwBej1ETInUjX2rq7EcfXuGc3HLHC3RZ425To8t3QFwwtheZH20wpmqES5z71TYVrQJPILWnVQmqA',
  parkStreet: 'https://lh3.googleusercontent.com/aida-public/AB6AXuADLAyaIjl6bu2f7FzGNuMasDJxA7mibvNjrFVNdgU3RQFZqX1RYM8zZS4gkmH-RQUBWZVXA4ZBbPaYaN7-BS1eNKWkBi_q47GwtNjqp45KAjio5vhnm1OrABuRpCl9VhZ0uM7j2gnQwEU-_wBq_piZZwOsjLA1tzCfWy0-YnndTPSl5ubUz4ziXjieY81eTPm_Hh2IcBD5aeG0gKgZ23TShLPRqTWOUqLOOI43YjnVQMKC0YsdJwHEzA',
};

export const SGEI_GOVERNING_COUNCIL: CommitteeMember[] = [
  {
    id: 'goenka',
    name: 'Dr. Anil Arora',
    role: 'President',
    image: anil,
  },
  {
    id: 'reddy',
    name: 'Dr. Manoj K. Sahu',
    role: 'President-Elect',
    image: manoj,
  },
  {
    id: 'lakhtakia',
    name: 'Dr. Ajay K. Jain',
    role: 'Vice President',
    image: ajay,
  },
  {
    id: 'gupta',
    name: 'Dr. Malay Sharma',
    role: 'HON. Secretary',
    image: malay,
  },
  {
    id: 'rana',
    name: 'Dr. Praveer Rai',
    role: 'JT. Secretary',
    image: praveer,
  },
  {
    id: 'kumar-ajay',
    name: 'Dr. Amitabh Jairath',
    role: 'Treasurer',
    image: amitabh,
  },
];

export const CORE_COMMITTEE: CommitteeMember[] = [
  {
    id: 'sharma',
    name: 'Dr. Alok Sharma',
    role: 'Organizing Chairman',
    image: CONFERENCE_IMAGES.alokSharma,
  },
  {
    id: 'das',
    name: 'Dr. Sunita Das',
    role: 'Scientific Committee Chair',
    image: CONFERENCE_IMAGES.sunitaDas,
  },
  {
    id: 'menon',
    name: 'Dr. Rajiv Menon',
    role: 'Organizing Secretary',
    image: CONFERENCE_IMAGES.rajivMenon,
  },
  {
    id: 'bhattacharya',
    name: 'Dr. Subhashish Bhattacharya',
    role: 'Joint Organizing Secretary',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=600',
  },
  {
    id: 'roy-anindya',
    name: 'Dr. Anindya Roy',
    role: 'Treasurer & Finance Chair',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=600',
  },
  {
    id: 'sen-pradeep',
    name: 'Dr. Pradeep Sen',
    role: 'Workshop & Hands-On Coordinator',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=600',
  },
];

export const COMMITTEE_MEMBERS: CommitteeMember[] = CORE_COMMITTEE;

export const KEYNOTE_SPEAKERS: Speaker[] = [
  {
    id: 'jenkins',
    name: 'Prof. Sarah Jenkins',
    role: 'Keynote Speaker',
    affiliation: 'Oxford University, UK',
    location: 'United Kingdom',
    specialty: 'Precision Medicine',
    image: 'https://images.unsplash.com/photo-1594824813576-ff6859ff4e20?auto=format&fit=crop&q=80&w=800',
    isKeynote: true,
    type: 'keynote',
    bio: 'Chair of Genomic Oncology at Oxford. Authored over 140 landmark peer-reviewed papers on targeted therapies for intractable malignancies.',
  },
  {
    id: 'tanaka',
    name: 'Dr. Hiroshi Tanaka',
    role: 'Keynote Speaker',
    affiliation: 'Tokyo Medical Center, Japan',
    location: 'Japan',
    specialty: 'Advanced Robotics',
    image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=800',
    isKeynote: true,
    type: 'keynote',
    bio: 'Director of Robotic Surgery Systems in Tokyo. Pioneer of tactile feedback micro-instruments and autonomous surgical assist algorithms.',
  },
];

export const INTERNATIONAL_FACULTY: Speaker[] = [
  {
    id: 'thompson',
    name: 'Dr. Emma Thompson',
    role: 'Faculty',
    affiliation: 'Johns Hopkins Medicine',
    location: 'USA',
    specialty: 'Cellular Therapy',
    image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400',
    type: 'international',
    bio: 'Associate Professor of Hematology specializing in chimeric antigen receptor T-cell manufacturing and patient monitoring.',
  },
  {
    id: 'chen',
    name: 'Dr. David Chen',
    role: 'Faculty',
    affiliation: 'University of Melbourne',
    location: 'Australia',
    specialty: 'Cardiac Interventions',
    image: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=400',
    type: 'international',
    bio: 'Interventional cardiologist recognized for novel biorestorative coronary scaffold deployments and real-time hemodynamic profiling.',
  },
  {
    id: 'garcia',
    name: 'Dr. Maria Garcia',
    role: 'Faculty',
    affiliation: 'Hospital Clínic de Barcelona',
    location: 'Spain',
    specialty: 'Neurocritical Care',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
    type: 'international',
    bio: 'Head of Neuro-Intensive Care unit with pioneering protocols in cerebral perfusion pressure modulation and traumatic brain injury.',
  },
  {
    id: 'mueller',
    name: 'Dr. Lars Mueller',
    role: 'Faculty',
    affiliation: 'Charité – Universitätsmedizin Berlin',
    location: 'Germany',
    specialty: 'Digital Health & AI',
    image: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&q=80&w=400',
    type: 'international',
    bio: 'Lead data scientist bridging large multimodal clinical models into ICU bedside alarm reduction and predictive sepsis alerts.',
  },
];

export const NATIONAL_FACULTY: Speaker[] = [
  {
    id: 'kumar',
    name: 'Dr. Rajesh Kumar',
    role: 'National Faculty',
    affiliation: 'All India Institute of Medical Sciences (AIIMS)',
    location: 'New Delhi',
    specialty: 'Endocrinology & Metabolism',
    image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=400',
    type: 'national',
    bio: 'Senior Consultant in metabolic diseases and lead coordinator for South Asian Type-2 Diabetes registry initiatives.',
  },
  {
    id: 'desai',
    name: 'Dr. Anjali Desai',
    role: 'National Faculty',
    affiliation: 'Tata Memorial Centre',
    location: 'Mumbai',
    specialty: 'Surgical Oncology',
    image: 'https://images.unsplash.com/photo-1594824813576-ff6859ff4e20?auto=format&fit=crop&q=80&w=400',
    type: 'national',
    bio: 'Chief of Gynecologic Oncology, recognized nationally for fertility-sparing cytoreductive surgeries and clinical protocol trials.',
  },
  {
    id: 'singh',
    name: 'Dr. Vikram Singh',
    role: 'National Faculty',
    affiliation: 'NIMHANS',
    location: 'Bangalore',
    specialty: 'Translational Neuroscience',
    image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400',
    type: 'national',
    bio: 'Principal Investigator researching neurodegenerative biomarkers, blood-brain barrier opening through focused ultrasound, and neural plasticity.',
  },
  {
    id: 'patel',
    name: 'Dr. Priya Patel',
    role: 'National Faculty',
    affiliation: 'B.J. Medical College',
    location: 'Ahmedabad',
    specialty: 'Pediatric Pulmonology',
    image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400',
    type: 'national',
    bio: 'Recipient of National Healthcare Excellence Citation for community asthma remediation models and pediatric bronchoscopy training.',
  },
];

export const SCIENTIFIC_PROGRAM: ProgramDay[] = [
  {
    day: 1,
    date: 'Nov 11, 2024',
    title: 'Inauguration & Precision Therapeutics',
    sessions: [
      {
        id: 'd1-s1',
        time: '08:00 - 09:00',
        title: 'Registration & Welcome Coffee',
        room: 'Main Foyer, ITC Sonar',
        category: 'Plenary',
        description: 'Badge distribution, delegate kit collection, and welcoming remarks in the exhibition hall.',
      },
      {
        id: 'd1-s2',
        time: '09:00 - 10:30',
        title: 'The Future of Precision Medicine',
        speaker: 'Prof. Sarah Jenkins',
        affiliation: 'Oxford University, UK',
        room: 'Plenary Hall A',
        category: 'Keynote',
        description: 'Comprehensive overview of next-generation genomic sequencing, patient profiling, and actionable targeted oncotherapies.',
      },
      {
        id: 'd1-s3',
        time: '10:30 - 11:00',
        title: 'Scientific Networking & Tea Break',
        room: 'Pre-Function Corridor',
        category: 'Break',
        description: 'Poster walk and networking with keynote delegates.',
      },
      {
        id: 'd1-s4',
        time: '11:00 - 13:00',
        title: 'Advanced Surgical & Endoscopy Techniques Lab',
        speaker: 'Dr. Hiroshi Tanaka & Dr. David Chen',
        affiliation: 'Tokyo Medical Center & University of Melbourne',
        room: 'Lab Room 3 (Endoscopy & Surgical Suite)',
        category: 'Workshop',
        description: 'Hands-on simulator training in advanced therapeutic endoscopy, endoscopic mucosal resection (EMR), robotic laparoscopic suturing, and high-definition video tower navigation.',
      },
      {
        id: 'd1-s5',
        time: '14:00 - 16:00',
        title: 'Symposium: Cellular Therapies and Immunotherapy',
        speaker: 'Dr. Emma Thompson & Dr. Anjali Desai',
        room: 'Hall B (Auditorium)',
        category: 'Symposium',
        description: 'Clinical trial outcomes and real-world toxicity management in autologous cell transfer programs.',
      },
      {
        id: 'd1-s6',
        time: '16:30 - 18:00',
        title: 'Presidential Panel: Global Healthcare Equity & Tech Adoption',
        speaker: 'Dr. Alok Sharma, Dr. Sunita Das & Dr. Lars Mueller',
        room: 'Plenary Hall A',
        category: 'Panel',
        description: 'Policy panel discussing affordable diagnostic access across low-and-middle-income regional healthcare corridors.',
      },
    ],
  },
  {
    day: 2,
    date: 'Nov 12, 2024',
    title: 'Robotics, AI & Minimally Invasive Interventions',
    sessions: [
      {
        id: 'd2-s1',
        time: '08:30 - 10:00',
        title: 'Autonomous Systems & Robotics in Clinical Practice',
        speaker: 'Dr. Hiroshi Tanaka',
        affiliation: 'Tokyo Medical Center, Japan',
        room: 'Plenary Hall A',
        category: 'Keynote',
        description: 'Sub-millimeter microsurgery with haptic tele-manipulation and machine learning guidance.',
      },
      {
        id: 'd2-s2',
        time: '10:15 - 12:30',
        title: 'AI in High-Acuity Triage & Diagnostic Radiology',
        speaker: 'Dr. Lars Mueller',
        affiliation: 'Charité Berlin, Germany',
        room: 'Hall C',
        category: 'Symposium',
        description: 'Automated stroke detection, chest CT triage, and validation against radiologist panels.',
      },
      {
        id: 'd2-s3',
        time: '12:30 - 13:30',
        title: 'Networking Lunch & Industry Presentation',
        room: 'Royal Pavilion',
        category: 'Break',
        description: 'Complimentary banquet lunch with industry partner presentations.',
      },
      {
        id: 'd2-s4',
        time: '13:30 - 15:30',
        title: 'Free Oral Paper Presentations: Shortlisted Finalists',
        speaker: 'Chaired by Dr. Sunita Das & Dr. Maria Garcia',
        room: 'Hall B & Lab 2',
        category: 'Plenary',
        description: 'Peer-reviewed presentations by young investigators and fellowship scholars.',
      },
      {
        id: 'd2-s5',
        time: '16:00 - 17:30',
        title: 'Interactive Case Debates: Complex Cardiovascular Anomalies',
        speaker: 'Dr. David Chen & Dr. Rajiv Menon',
        room: 'Plenary Hall A',
        category: 'Panel',
        description: 'Audience voting and live case reviews on tricky structural heart interventions.',
      },
      {
        id: 'd2-s6',
        time: '19:30 - 22:30',
        title: 'Gala Dinner & Kolkata Cultural Extravaganza',
        room: 'ITC Sonar Lawn',
        category: 'Break',
        description: 'Traditional Bengali cultural performances, sitar recital, and multi-cuisine royal banquet.',
      },
    ],
  },
  {
    day: 3,
    date: 'Nov 13, 2024',
    title: 'Future Horizons, Awards & Valedictory',
    sessions: [
      {
        id: 'd3-s1',
        time: '09:00 - 10:30',
        title: 'Neurocritical Care: Managing Hemodynamic Crisis',
        speaker: 'Dr. Maria Garcia',
        affiliation: 'Hospital Clínic de Barcelona',
        room: 'Plenary Hall A',
        category: 'Symposium',
        description: 'Novel bedside multimodal neuromonitoring protocols and early ischemic prevention.',
      },
      {
        id: 'd3-s2',
        time: '10:45 - 12:30',
        title: 'Translational Metabolic Medicine & Pediatric Respiratory Care',
        speaker: 'Dr. Rajesh Kumar & Dr. Priya Patel',
        room: 'Hall B',
        category: 'Symposium',
        description: 'Integrative management of childhood respiratory allergies and youth-onset endocrine conditions.',
      },
      {
        id: 'd3-s3',
        time: '13:30 - 15:00',
        title: 'Young Investigator Award Ceremonies & Poster Laureates',
        speaker: 'Jury Committee',
        room: 'Plenary Hall A',
        category: 'Plenary',
        description: 'Recognition of the best scientific contributions with international travel grants and gold medals.',
      },
      {
        id: 'd3-s4',
        time: '15:15 - 16:30',
        title: 'Valedictory Address, CME Accreditation & Closing Remarks',
        speaker: 'Dr. Alok Sharma & Dr. Rajiv Menon',
        room: 'Plenary Hall A',
        category: 'Plenary',
        description: 'Issuance of 12 CME credit hour certificates, closing remarks, and handover to the 2025 host city.',
      },
    ],
  },
];

const PACKAGE_CONTENT: ConferenceRegistrationCategory[] = [
  {
    id: 'sgei-member',
    category: 'SGEI Member',
    type: 'national',
    currency: 'INR',
    badge: 'POPULAR CHOICE',
    isRecommended: true,
    qualification: 'Registered Life & Annual members of Society of Gastrointestinal Endoscopy of India',
    earlyBird: 'INR 18,500/-',
    earlyBirdAmount: 18500,
    regular: 'INR 21,500/-',
    regularAmount: 21500,
    onSpot: 'INR 24,500/-',
    onSpotAmount: 24500,
    inclusions: [
      'Registration & Full Scientific Sessions Access',
      '4 Lunches & Continuous Hospitality Tea/Coffee',
      '2 Dinners & 1 Gala Banquet Dinner',
      'Official Delegate Registration Kit & Bag',
      'Accredited Certificate of Participation (CME Hours)',
    ],
  },
  {
    id: 'non-member',
    category: 'Non-Member',
    type: 'national',
    currency: 'INR',
    badge: 'SPECIALISTS & FACULTY',
    qualification: 'Practicing Physicians, Gastroenterologists, Surgeons & Allied Specialists',
    earlyBird: 'INR 21,500/-',
    earlyBirdAmount: 21500,
    regular: 'INR 24,500/-',
    regularAmount: 24500,
    onSpot: 'INR 27,500/-',
    onSpotAmount: 27500,
    inclusions: [
      'Full Conference & Scientific Sessions Access',
      '4 Lunches & Continuous Hospitality Tea/Coffee',
      '2 Dinners & 1 Gala Banquet Dinner',
      'Official Delegate Registration Kit & Bag',
      'Accredited Certificate of Participation (CME Hours)',
    ],
  },
  {
    id: 'pg-student',
    category: 'PG Student',
    type: 'national',
    currency: 'INR',
    badge: 'SUBSIDIZED ACADEMIC RATE',
    qualification: 'Postgraduates, MD/MS/DNB Residents & Research Fellows (HOD letter required)',
    earlyBird: 'INR 16,500/-',
    earlyBirdAmount: 16500,
    regular: 'INR 19,500/-',
    regularAmount: 19500,
    onSpot: 'INR 22,500/-',
    onSpotAmount: 22500,
    inclusions: [
      'Access to All Scientific Sessions & Free Paper Tracks',
      '4 Lunches & Continuous Hospitality Tea/Coffee',
      '2 Dinners & 1 Gala Banquet Dinner',
      'Official Delegate Registration Kit',
      'Eligibility for Best Young Investigator Award & Certificate',
    ],
  },
  {
    id: 'accompanying-national',
    category: 'Accompanying National',
    type: 'accompanying-national',
    currency: 'INR',
    badge: 'FAMILY & GUEST',
    qualification: 'Spouse or family guest of registered domestic delegate (Non-scientific pass)',
    earlyBird: 'INR 12,000/-',
    earlyBirdAmount: 12000,
    regular: 'INR 14,000/-',
    regularAmount: 14000,
    onSpot: 'INR 18,000/-',
    onSpotAmount: 18000,
    inclusions: [
      'Entry to Conference Hospitality & Exhibition Lounges',
      '4 Lunches & Continuous Refreshments',
      '2 Dinners & 1 Grand Gala Banquet Dinner',
      'Access to Cultural Evening & City Tour Coordination',
      'Non-Residential Pass (excludes CME certificate)',
    ],
  },
  {
    id: 'international-delegate',
    category: 'International Delegate',
    type: 'international',
    currency: 'USD',
    badge: 'OVERSEAS DELEGATE',
    isRecommended: true,
    qualification: 'Overseas Clinicians, International Faculty & Researchers',
    earlyBird: 'USD 350',
    earlyBirdAmount: 350,
    regular: 'USD 450',
    regularAmount: 450,
    onSpot: 'USD 550',
    onSpotAmount: 550,
    inclusions: [
      'Full 3-Day International Delegate All-Access Pass',
      '4 Lunches, 2 Dinners & 1 Grand Gala Banquet Dinner',
      'Visa Assistance & Ministry Clearance Documentation',
      'Official Delegate Registration Kit & Hardbound Programme',
      'Validated International CME Accreditation Certificate',
    ],
  },
  {
    id: 'accompanying-international',
    category: 'Accompanying International',
    type: 'accompanying-international',
    currency: 'USD',
    badge: 'INTERNATIONAL GUEST',
    qualification: 'Spouse or family guest accompanying registered overseas delegate',
    earlyBird: 'USD 200',
    earlyBirdAmount: 200,
    regular: 'USD 250',
    regularAmount: 250,
    onSpot: 'USD 300',
    onSpotAmount: 300,
    inclusions: [
      'Entry to Conference Hospitality & Dining Pavilions',
      '4 Lunches & Continuous Refreshments',
      '2 Dinners & 1 Grand Gala Banquet Dinner',
      'Access to Inaugural & Cultural Showcases',
      'Complimentary Kolkata Heritage Half-Day Tour',
    ],
  },
];

const HOTEL_CONTENT: AccommodationOption[] = [
  {
    id: 'itc-royal-bengal',
    hotel: 'ITC Royal Bengal (Venue)',
    isVenue: true,
    category: '5-Star Luxury Conference Venue',
    singleOccupancy: 'INR 14,000/-',
    singleAmount: 14000,
    twinShare: 'INR 8,000/-',
    twinAmount: 8000,
    highlights: [
      'Direct indoor connection to Conference Halls & Exhibition',
      'Complimentary daily buffet breakfast included',
      'Complimentary high-speed Wi-Fi',
      'Any additional charges incurred during the stay, including extra bed, room service, laundry, minibar, additional nights, upgrades, or other personal expenses, will be borne by the guest',
    ],
  },
  {
    id: 'alternate-nearby-hotel',
    hotel: 'Alternate Nearby Hotel',
    isVenue: false,
    category: '4-Star Premium Partner Hotel (Within 2.5 km)',
    singleOccupancy: 'INR 10,000/-',
    singleAmount: 10000,
    twinShare: 'INR 6,500/-',
    twinAmount: 6500,
    highlights: [
      'Complimentary daily buffet breakfast included',
      'Delegate helpdesk',
      'Any additional charges incurred during the stay, including extra bed, room service, laundry, minibar, additional nights, upgrades, or other personal expenses, will be borne by the guest',
    ],
  },
];

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'pg-student',
    name: 'PG Student',
    priceInr: 'INR 16,500/-',
    priceUsd: '$200',
    features: [
      'Access to All Scientific Sessions & Poster Halls',
      '4 Lunches, 2 Dinners & 1 Gala Dinner',
      'Official Delegate Registration Kit',
      'Certificate of Participation (CME Credits)',
    ],
  },
  {
    id: 'sgei-member',
    name: 'SGEI Member',
    priceInr: 'INR 18,500/-',
    priceUsd: '$230',
    isFeatured: true,
    tag: 'POPULAR CHOICE',
    features: [
      'Full Conference & Live Endoscopy Transmission Access',
      '4 Lunches, 2 Dinners & 1 Gala Dinner',
      'Official Delegate Registration Kit & Bag',
      'Accredited CME Certificate of Participation',
    ],
  },
  {
    id: 'international-delegate',
    name: 'International Delegate',
    priceInr: 'INR 29,000/-',
    priceUsd: 'USD 350',
    features: [
      'All-Inclusive International Delegate Pass',
      '4 Lunches, 2 Dinners & 1 Gala Banquet Dinner',
      'Visa Invitation & Clearance Documentation',
      'Official Delegate Kit & Validated CME Certificate',
    ],
  },
];

export const ATTRACTIONS: Attraction[] = [
  {
    id: 'victoria',
    name: 'Victoria Memorial',
    description: 'An iconic marble building dedicated to Queen Victoria.',
    fullDetails:
      'Completed in 1921, this colossal white Makrana marble palace sits amid 64 acres of landscaped gardens, housing 25 galleries of rare historical paintings, colonial memorabilia, and sculpture.',
    image: CONFERENCE_IMAGES.victoriaMemorial,
    highlight: 'Iconic Monument',
  },
  {
    id: 'howrah',
    name: 'Howrah Bridge',
    description: 'The bustling lifeline over the Hooghly River.',
    fullDetails:
      'One of the longest cantilever suspension bridges in the world, the Rabindra Setu connects Kolkata and Howrah carrying over 100,000 vehicles and millions of commuters daily without a single pylon in the river.',
    image: CONFERENCE_IMAGES.howrahBridge,
    highlight: 'Architectural Marvel',
  },
  {
    id: 'parkstreet',
    name: 'Park Street',
    description: 'The culinary and cultural heart of the city.',
    fullDetails:
      'Kolkata’s legendary entertainment avenue, renowned for historic heritage tearooms (Flurys), live jazz institutions (Mocambo, Peter Cat), vibrant bookstores, and illuminated colonial boulevards.',
    image: CONFERENCE_IMAGES.parkStreet,
    highlight: 'Dining & Heritage',
  },
];

export const SPONSORS = {
  platinum: [
    { name: 'Novis MedTech International', tag: 'Surgical Robotics' },
    { name: 'AstraBio Genomics', tag: 'Precision Oncology' },
  ],
  gold: [
    { name: 'Zenith Diagnostics', tag: 'High-Throughput Labs' },
    { name: 'Vanguard Biopharma', tag: 'Biologics & Vaccines' },
    { name: 'Kolkata Health Tech', tag: 'Digital Imaging' },
  ],
  silver: [
    { name: 'MedPulse Devices' },
    { name: 'Apex Clinical Systems' },
    { name: 'Beacon Scientific' },
    { name: 'CareLink Telehealth' },
  ],
};

// Dates from the Registration Brief. Abstract deadlines are not in the documents yet – update
// here (and ABSTRACT_SUBMISSION_* in the backend .env) once the Scientific Committee confirms them.
export const IMPORTANT_DATES = [
  {
    date: '1 November 2026',
    title: 'Online Registration & Abstract Submission',
    desc: 'Create your delegate account, register and submit your abstracts online.',
    status: 'current',
  },
  {
    date: '15 January 2027',
    title: 'Early Bird Registration Closes',
    desc: 'Register by 15 January 2027 (IST) for Early Bird rates.',
    status: 'upcoming',
  },
  {
    date: '16 January – 10 April 2027',
    title: 'Regular Registration',
    desc: 'Regular registration rates apply.',
    status: 'upcoming',
  },
  {
    date: '22 March 2027',
    title: 'Last Date for Cancellation (75% refund)',
    desc: 'Written requests to the Conference Secretariat by 11:59 PM IST. GST & bank charges are non-refundable.',
    status: 'upcoming',
  },
  {
    date: '22 – 25 April 2027',
    title: 'ENDOCON 2027 at ITC Royal Bengal, Kolkata',
    desc: 'On-spot registration rates apply after 10 April 2027.',
    status: 'upcoming',
  },
];


// ---------------------------------------------------------------------------------------------
// Prices on the landing page come from the shared static catalogue (../shared/catalogue.json),
// so they can never differ from what the registration flow charges. The texts above (badges,
// inclusions, highlights) are marketing content only.
// ---------------------------------------------------------------------------------------------
const PRICE_SOURCE = catalogueFile;
const label = (currency: string, amount: number) =>
  currency === 'USD' ? `USD ${amount.toLocaleString('en-US')}` : `INR ${amount.toLocaleString('en-IN')}/-`;

export const CONFERENCE_REGISTRATION_PACKAGES: ConferenceRegistrationCategory[] = PACKAGE_CONTENT.map((pkg) => {
  const c = PRICE_SOURCE.conferenceCategories.find((x) => x.code === pkg.id);
  if (!c) return pkg;
  const p = c.prices as Record<string, number>;
  return {
    ...pkg,
    category: c.name,
    currency: c.currency as ConferenceRegistrationCategory['currency'],
    earlyBird: label(c.currency, p.early_bird),
    earlyBirdAmount: p.early_bird,
    regular: label(c.currency, p.regular),
    regularAmount: p.regular,
    onSpot: label(c.currency, p.on_spot),
    onSpotAmount: p.on_spot,
  };
});

/** Landing-page hotel cards → catalogue room codes (single / twin share). */
const HOTEL_ROOMS: Record<string, { single: string; twin: string }> = {
  'itc-royal-bengal': { single: 'venue-single', twin: 'venue-twin' },
  'alternate-nearby-hotel': { single: 'alternate-single', twin: 'alternate-twin' },
};

export const ACCOMMODATION_OPTIONS: AccommodationOption[] = HOTEL_CONTENT.map((h) => {
  const rooms = HOTEL_ROOMS[h.id];
  const single = rooms && PRICE_SOURCE.accommodation.options.find((o) => o.code === rooms.single);
  const twin = rooms && PRICE_SOURCE.accommodation.options.find((o) => o.code === rooms.twin);
  return {
    ...h,
    ...(single ? { singleOccupancy: label('INR', single.nightly), singleAmount: single.nightly } : {}),
    ...(twin ? { twinShare: label('INR', twin.nightly), twinAmount: twin.nightly } : {}),
  };
});
