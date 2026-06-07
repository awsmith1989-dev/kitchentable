import { useEffect, useMemo, useState } from 'react';
import { ClassRecord, School, Student, WeeklyClassGrade } from '../lib/types';

// ── Types ──────────────────────────────────────────────────────────────────

interface Career {
  title: string;
  edu: 'HS' | 'AS' | 'BS';
  outlook: 'AA' | 'A' | 'BA' | 'D';
  wage: number | null;
  interestTags: string[];
  subjectTags: string[];
}

interface LiveCollege {
  name: string;
  city: string;
  type: string;
  size: string;
  admissionRate: string;
  netPrice: string;
  medianEarnings: string | null;
  completionRate: string | null;
  url: string | null;
  matchReason: string;
  score: number;
}

interface ScoredCareer extends Career {
  score: number;
  matchReason: string;
  interestMatches: string[];
  subjectMatches: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const OUTLOOK_LABEL: Record<string, string> = {
  AA: 'Above Average Growth',
  A: 'Average Growth',
  BA: 'Below Average Growth',
  D: 'Declining',
};

const OUTLOOK_PRIORITY: Record<string, number> = { AA: 0, A: 1, BA: 2, D: 3 };

const EDU_BADGE: Record<string, string> = {
  HS: 'HS Diploma',
  AS: "Associate's",
  BS: "Bachelor's",
};

// Maps words that might appear in student text to career interest tag categories
const KEYWORD_TO_TAGS: Record<string, string[]> = {
  // Healthcare / Medicine
  health: ['healthcare'], healthcare: ['healthcare'], care: ['healthcare', 'social'],
  medicine: ['healthcare', 'medicine'], medical: ['healthcare', 'medicine'],
  doctor: ['healthcare', 'medicine'], doctors: ['healthcare', 'medicine'],
  nurse: ['healthcare', 'nursing'], nursing: ['healthcare', 'nursing'],
  hospital: ['healthcare'], clinic: ['healthcare'], patient: ['healthcare'],
  pharmacy: ['healthcare', 'medicine'], surgeon: ['healthcare', 'medicine'],
  anatomy: ['healthcare', 'biology'], physiology: ['healthcare', 'biology'],
  biology: ['healthcare', 'science', 'biology'], dentist: ['healthcare', 'dentistry'],
  dental: ['healthcare', 'dentistry'], dentistry: ['healthcare', 'dentistry'],
  therapy: ['social', 'therapy'], therapist: ['social', 'therapy'],
  nutrition: ['food', 'healthcare'], nutritional: ['food', 'healthcare'],
  // Technology
  technology: ['technology'], tech: ['technology'], digital: ['technology'],
  coding: ['technology', 'coding'], code: ['technology', 'coding'],
  programming: ['technology', 'coding'], program: ['technology', 'coding'],
  software: ['technology', 'coding'], developer: ['technology', 'coding'],
  app: ['technology', 'coding'], apps: ['technology', 'coding'],
  website: ['technology', 'coding'], web: ['technology', 'coding'],
  computer: ['technology', 'computers'], computers: ['technology', 'computers'],
  gaming: ['technology', 'computers'], games: ['technology', 'computers'],
  cybersecurity: ['technology', 'IT'], network: ['technology', 'IT'],
  data: ['data', 'technology'], analytics: ['data', 'technology'],
  // Engineering
  engineering: ['engineering'], engineer: ['engineering'],
  electrical: ['engineering', 'electrical', 'trades'],
  mechanical: ['engineering'], civil: ['engineering', 'construction'],
  // Trades
  welding: ['trades'], weld: ['trades'], welder: ['trades'],
  plumbing: ['trades'], plumber: ['trades'],
  carpenter: ['trades', 'construction'], carpentry: ['trades', 'construction'],
  electrician: ['trades', 'electrical'],
  mechanic: ['trades', 'automotive'],
  construction: ['trades', 'construction'], build: ['construction'], building: ['construction'],
  contractor: ['trades', 'construction'], fix: ['trades', 'automotive'],
  // Business & Finance
  business: ['business'], entrepreneur: ['business'], entrepreneurship: ['business'],
  finance: ['finance', 'business'], financial: ['finance', 'business'],
  money: ['finance'], banking: ['finance'], bank: ['finance'],
  accounting: ['finance', 'business'], accountant: ['finance', 'business'],
  investment: ['finance'], investing: ['finance'],
  marketing: ['marketing', 'communications', 'business'],
  sales: ['business', 'sales'],
  management: ['management', 'business'], managing: ['management'],
  leadership: ['management', 'business'], leader: ['management'],
  // Education & Teaching
  teaching: ['education'], teacher: ['education'], education: ['education'],
  tutoring: ['education'], classroom: ['education'],
  // Social Work & Community
  social: ['social', 'community'], helping: ['social', 'community', 'healthcare'],
  help: ['social', 'community'], counseling: ['social'],
  counselor: ['social'], community: ['community'], volunteer: ['community'],
  children: ['children', 'education'], child: ['children', 'education'],
  kids: ['children', 'education'], childcare: ['children', 'education'],
  // Law & Safety
  law: ['law'], lawyer: ['law'], attorney: ['law'], legal: ['law'],
  police: ['safety', 'law'], officer: ['safety', 'law'], security: ['safety'],
  justice: ['law', 'government'], criminal: ['law'],
  firefighter: ['safety'], military: ['military', 'safety'],
  army: ['military'], navy: ['military'], marines: ['military'],
  government: ['government', 'law'], politics: ['government'],
  // Sports & Fitness
  sports: ['sports', 'fitness'], sport: ['sports'],
  basketball: ['sports'], football: ['sports'], baseball: ['sports'],
  soccer: ['sports'], volleyball: ['sports'], tennis: ['sports'],
  track: ['sports'], softball: ['sports'], wrestling: ['sports'],
  athletics: ['sports'], athletic: ['sports'],
  fitness: ['fitness'], gym: ['fitness'], workout: ['fitness'],
  // Arts & Design
  art: ['art', 'design'], artwork: ['art'], artistic: ['art'],
  drawing: ['art'], painting: ['art'], artist: ['art'],
  music: ['music'], musical: ['music'], singing: ['music'],
  band: ['music'], guitar: ['music'], piano: ['music'], choir: ['music'],
  design: ['design', 'art'], graphic: ['design', 'communications'],
  photography: ['art', 'design', 'communications'],
  writing: ['writing', 'communications'], writer: ['writing'],
  journalism: ['writing', 'communications'],
  // Science & Research
  science: ['science'], scientific: ['science'], lab: ['science', 'research'],
  research: ['science', 'research'], chemistry: ['science', 'chemistry'],
  physics: ['science', 'physics'], environment: ['environment'],
  nature: ['environment'], conservation: ['environment'], ecology: ['environment'],
  agriculture: ['agriculture'], farming: ['agriculture'], farm: ['agriculture'],
  animals: ['animals'], animal: ['animals'], pets: ['animals'], pet: ['animals'],
  veterinary: ['animals', 'healthcare'], vet: ['animals', 'healthcare'],
  // Food & Hospitality
  cooking: ['culinary'], cook: ['culinary'], chef: ['culinary'],
  culinary: ['culinary'], baking: ['culinary'], restaurant: ['culinary', 'hospitality'],
  food: ['food', 'culinary'], hospitality: ['hospitality'], hotel: ['hospitality'],
  // Aviation & Architecture
  aviation: ['aviation'], pilot: ['aviation'], airplane: ['aviation'],
  architecture: ['architecture'], architect: ['architecture'],
  // Automotive
  automotive: ['automotive'], car: ['automotive'], cars: ['automotive'], auto: ['automotive'],
  // Communications
  communications: ['communications'], communication: ['communications'], media: ['communications'],
  // Statistics / Data
  statistics: ['data', 'science'], statistical: ['data'],
};

// Maps career subject tags to common class name fragments
const SUBJECT_ALIASES: Record<string, string[]> = {
  math: ['math', 'algebra', 'geometry', 'calculus', 'trigonometry', 'precalculus', 'statistics', 'stem'],
  science: ['science', 'chemistry', 'physics', 'biology', 'earth science', 'environmental', 'stem'],
  biology: ['biology', 'life science', 'anatomy', 'physiology', 'genetics', 'microbiology'],
  chemistry: ['chemistry', 'chem'],
  physics: ['physics'],
  english: ['english', 'language arts', 'ela', 'literature', 'writing', 'reading', 'composition', 'humanities'],
  social: ['social studies', 'social science', 'history', 'government', 'civics', 'economics', 'geography', 'world history'],
  technology: ['technology', 'computer', 'information technology', 'stem', 'digital', 'engineering'],
  art: ['art', 'drawing', 'painting', 'music', 'theater', 'drama', 'choir', 'orchestra', 'band', 'creative'],
  health: ['health', 'physical education', 'pe', 'wellness', 'fitness', 'kinesiology'],
  business: ['business', 'economics', 'marketing', 'finance', 'accounting', 'entrepreneurship', 'management'],
  computer: ['computer', 'programming', 'coding', 'information technology', 'stem', 'digital'],
};

// ── Career data ─────────────────────────────────────────────────────────────

const CAREERS: Career[] = [
  // High School Diploma
  { title: 'Electricians', edu: 'HS', outlook: 'A', wage: 49420, interestTags: ['trades', 'construction', 'technology', 'electrical'], subjectTags: ['math', 'physics'] },
  { title: 'Carpenters', edu: 'HS', outlook: 'A', wage: 46320, interestTags: ['trades', 'construction', 'design'], subjectTags: ['math', 'technology'] },
  { title: 'Chefs and Head Cooks', edu: 'HS', outlook: 'A', wage: 40060, interestTags: ['culinary', 'food', 'hospitality', 'business'], subjectTags: ['science', 'art'] },
  { title: 'Child Care Workers', edu: 'HS', outlook: 'A', wage: 27160, interestTags: ['education', 'social', 'healthcare', 'children'], subjectTags: ['social', 'health'] },
  { title: 'Automotive Body Repairers', edu: 'HS', outlook: 'AA', wage: 47230, interestTags: ['trades', 'automotive', 'technology'], subjectTags: ['math', 'technology'] },
  { title: 'Home Health and Personal Care Aides', edu: 'HS', outlook: 'AA', wage: 27110, interestTags: ['healthcare', 'social', 'community', 'children'], subjectTags: ['health', 'social'] },
  { title: 'Brickmasons and Blockmasons', edu: 'HS', outlook: 'AA', wage: 48100, interestTags: ['trades', 'construction'], subjectTags: ['math', 'technology'] },
  { title: 'Construction and Building Inspectors', edu: 'HS', outlook: 'D', wage: 52970, interestTags: ['construction', 'technology', 'government'], subjectTags: ['math', 'science'] },
  { title: 'Food Service Managers', edu: 'HS', outlook: 'A', wage: 53880, interestTags: ['culinary', 'business', 'hospitality', 'food'], subjectTags: ['business', 'math'] },
  { title: 'Police and Sheriffs Patrol Officers', edu: 'HS', outlook: 'A', wage: 48090, interestTags: ['safety', 'law', 'government', 'community'], subjectTags: ['social', 'health'] },
  { title: 'Plumbers, Pipefitters and Steamfitters', edu: 'HS', outlook: 'BA', wage: 49700, interestTags: ['trades', 'construction'], subjectTags: ['math', 'science'] },
  { title: 'Real Estate Sales Agents', edu: 'HS', outlook: 'A', wage: 38450, interestTags: ['business', 'sales', 'finance'], subjectTags: ['math', 'social', 'business'] },
  { title: 'Recreation Workers', edu: 'HS', outlook: 'AA', wage: 26520, interestTags: ['sports', 'fitness', 'community', 'education'], subjectTags: ['health', 'social'] },
  { title: 'Security Guards', edu: 'HS', outlook: 'A', wage: 37000, interestTags: ['safety', 'law'], subjectTags: ['social', 'health'] },
  { title: 'Sheet Metal Workers', edu: 'HS', outlook: 'A', wage: 42640, interestTags: ['trades', 'manufacturing', 'technology'], subjectTags: ['math', 'physics', 'technology'] },
  { title: 'Welding, Soldering and Brazing Workers', edu: 'HS', outlook: 'A', wage: null, interestTags: ['trades', 'manufacturing'], subjectTags: ['math', 'science', 'technology'] },
  { title: 'Farm Equipment Mechanics', edu: 'HS', outlook: 'A', wage: 47720, interestTags: ['agriculture', 'trades', 'technology'], subjectTags: ['math', 'science', 'technology'] },
  { title: 'Millwrights', edu: 'HS', outlook: 'A', wage: 50510, interestTags: ['trades', 'manufacturing', 'technology'], subjectTags: ['math', 'physics', 'technology'] },
  // Associate's Degree
  { title: 'Dental Hygienists', edu: 'AS', outlook: 'A', wage: 83760, interestTags: ['healthcare', 'dentistry', 'science'], subjectTags: ['science', 'biology', 'math'] },
  { title: 'Cardiovascular Technologists', edu: 'AS', outlook: 'A', wage: 70930, interestTags: ['healthcare', 'medicine', 'science'], subjectTags: ['biology', 'science', 'math'] },
  { title: 'Occupational Therapy Assistants', edu: 'AS', outlook: 'AA', wage: 77340, interestTags: ['healthcare', 'social', 'therapy'], subjectTags: ['science', 'health', 'social'] },
  { title: 'Physical Therapist Assistants', edu: 'AS', outlook: 'AA', wage: 67230, interestTags: ['healthcare', 'sports', 'fitness', 'therapy'], subjectTags: ['science', 'health', 'biology'] },
  { title: 'Respiratory Therapists', edu: 'AS', outlook: 'A', wage: 67960, interestTags: ['healthcare', 'medicine', 'science'], subjectTags: ['science', 'biology', 'health'] },
  { title: 'Radiologic Technologists', edu: 'AS', outlook: 'BA', wage: 60430, interestTags: ['healthcare', 'medicine', 'technology'], subjectTags: ['science', 'biology', 'technology'] },
  { title: 'Diagnostic Medical Sonographers', edu: 'AS', outlook: 'A', wage: 78500, interestTags: ['healthcare', 'medicine', 'technology'], subjectTags: ['science', 'biology', 'technology'] },
  { title: 'Paralegal and Legal Assistants', edu: 'AS', outlook: 'BA', wage: 46940, interestTags: ['law', 'business', 'government'], subjectTags: ['social', 'english'] },
  { title: 'Air Traffic Controllers', edu: 'AS', outlook: 'BA', wage: 99490, interestTags: ['aviation', 'technology', 'safety'], subjectTags: ['math', 'science', 'technology'] },
  { title: 'Architectural and Civil Drafters', edu: 'AS', outlook: 'A', wage: 60390, interestTags: ['architecture', 'design', 'engineering'], subjectTags: ['math', 'art', 'technology'] },
  { title: 'Computer Network Support Specialists', edu: 'AS', outlook: 'A', wage: 58790, interestTags: ['technology', 'computers', 'IT'], subjectTags: ['math', 'technology', 'computer'] },
  { title: 'Agricultural Technicians', edu: 'AS', outlook: 'A', wage: 43950, interestTags: ['agriculture', 'science', 'environment'], subjectTags: ['science', 'biology', 'math'] },
  { title: 'Chemical Technicians', edu: 'AS', outlook: 'A', wage: 46720, interestTags: ['science', 'technology', 'manufacturing'], subjectTags: ['science', 'chemistry', 'math'] },
  { title: 'Electrical Engineering Technologists', edu: 'AS', outlook: 'BA', wage: 70340, interestTags: ['engineering', 'technology', 'electrical'], subjectTags: ['math', 'physics', 'technology'] },
  { title: 'Nuclear Medicine Technologists', edu: 'AS', outlook: 'BA', wage: 75150, interestTags: ['healthcare', 'medicine', 'technology'], subjectTags: ['science', 'biology', 'physics'] },
  { title: 'Human Resources Assistants', edu: 'AS', outlook: 'BA', wage: 44850, interestTags: ['business', 'social', 'management'], subjectTags: ['social', 'business', 'english'] },
  { title: 'Veterinary Technologists and Technicians', edu: 'AS', outlook: 'AA', wage: 34880, interestTags: ['animals', 'science', 'healthcare'], subjectTags: ['science', 'biology', 'health'] },
  { title: 'Food Science Technicians', edu: 'AS', outlook: 'D', wage: 46400, interestTags: ['food', 'science', 'agriculture'], subjectTags: ['science', 'chemistry', 'biology'] },
  { title: 'Preschool Teachers', edu: 'AS', outlook: 'AA', wage: 36050, interestTags: ['education', 'social', 'children'], subjectTags: ['social', 'english'] },
  // Bachelor's Degree
  { title: 'Registered Nurses', edu: 'BS', outlook: 'A', wage: 77130, interestTags: ['healthcare', 'nursing', 'medicine', 'science'], subjectTags: ['science', 'biology', 'health'] },
  { title: 'Software Developers', edu: 'BS', outlook: 'AA', wage: 96820, interestTags: ['technology', 'computers', 'coding', 'programming'], subjectTags: ['math', 'computer', 'technology'] },
  { title: 'Information Security Analysts', edu: 'BS', outlook: 'AA', wage: 93560, interestTags: ['technology', 'safety', 'computers', 'IT'], subjectTags: ['math', 'technology', 'computer'] },
  { title: 'Data Scientists', edu: 'BS', outlook: 'AA', wage: 104320, interestTags: ['technology', 'science', 'data', 'computers'], subjectTags: ['math', 'science', 'technology'] },
  { title: 'Marketing Managers', edu: 'BS', outlook: 'A', wage: 127320, interestTags: ['business', 'communications', 'marketing'], subjectTags: ['social', 'english', 'business', 'art'] },
  { title: 'Sales Managers', edu: 'BS', outlook: 'BA', wage: 119990, interestTags: ['business', 'sales', 'communications'], subjectTags: ['social', 'business', 'math'] },
  { title: 'Computer and Information Systems Managers', edu: 'BS', outlook: 'A', wage: 118230, interestTags: ['technology', 'business', 'computers', 'management'], subjectTags: ['math', 'technology', 'business'] },
  { title: 'Computer Systems Analysts', edu: 'BS', outlook: 'A', wage: 72540, interestTags: ['technology', 'computers', 'business'], subjectTags: ['math', 'technology', 'computer'] },
  { title: 'Database Administrators', edu: 'BS', outlook: 'A', wage: 79710, interestTags: ['technology', 'computers', 'data'], subjectTags: ['math', 'technology', 'computer'] },
  { title: 'Computer Network Architects', edu: 'BS', outlook: 'A', wage: 109900, interestTags: ['technology', 'computers', 'engineering', 'IT'], subjectTags: ['math', 'technology', 'computer'] },
  { title: 'Elementary School Teachers', edu: 'BS', outlook: 'A', wage: 50550, interestTags: ['education', 'children', 'social', 'community'], subjectTags: ['english', 'social', 'math'] },
  { title: 'Middle School Teachers', edu: 'BS', outlook: 'A', wage: 56980, interestTags: ['education', 'social', 'community'], subjectTags: ['english', 'social', 'math'] },
  { title: 'Secondary School Teachers', edu: 'BS', outlook: 'A', wage: 56890, interestTags: ['education', 'social', 'community'], subjectTags: ['english', 'social', 'math'] },
  { title: 'Social Workers', edu: 'BS', outlook: 'BA', wage: 46210, interestTags: ['social', 'community', 'healthcare'], subjectTags: ['social', 'english'] },
  { title: 'Substance Abuse and Mental Health Counselors', edu: 'BS', outlook: 'AA', wage: 49990, interestTags: ['social', 'healthcare', 'community'], subjectTags: ['social', 'health'] },
  { title: 'Accountants and Auditors', edu: 'BS', outlook: 'A', wage: 64180, interestTags: ['finance', 'business', 'math'], subjectTags: ['math', 'business', 'technology'] },
  { title: 'Financial Managers', edu: 'BS', outlook: 'A', wage: 103410, interestTags: ['finance', 'business', 'management'], subjectTags: ['math', 'business'] },
  { title: 'Human Resources Managers', edu: 'BS', outlook: 'A', wage: 99760, interestTags: ['business', 'social', 'management'], subjectTags: ['social', 'business', 'english'] },
  { title: 'Project Management Specialists', edu: 'BS', outlook: 'A', wage: 81970, interestTags: ['business', 'technology', 'management'], subjectTags: ['math', 'business', 'technology'] },
  { title: 'Public Relations Managers', edu: 'BS', outlook: 'A', wage: 140970, interestTags: ['communications', 'business', 'marketing'], subjectTags: ['english', 'social', 'business'] },
  { title: 'Electrical Engineers', edu: 'BS', outlook: 'A', wage: 96500, interestTags: ['engineering', 'technology', 'electrical'], subjectTags: ['math', 'physics', 'technology'] },
  { title: 'Civil Engineers', edu: 'BS', outlook: 'A', wage: 81930, interestTags: ['engineering', 'construction', 'environment'], subjectTags: ['math', 'science', 'physics'] },
  { title: 'Environmental Engineers', edu: 'BS', outlook: 'A', wage: 84600, interestTags: ['engineering', 'environment', 'science'], subjectTags: ['science', 'chemistry', 'math'] },
  { title: 'Industrial Engineers', edu: 'BS', outlook: 'A', wage: 94184, interestTags: ['engineering', 'manufacturing', 'technology'], subjectTags: ['math', 'physics', 'technology'] },
  { title: 'Mechanical Engineers', edu: 'BS', outlook: 'BA', wage: 78570, interestTags: ['engineering', 'technology', 'manufacturing'], subjectTags: ['math', 'physics', 'technology'] },
  { title: 'Architects', edu: 'BS', outlook: 'BA', wage: 84310, interestTags: ['architecture', 'design', 'engineering', 'art'], subjectTags: ['math', 'art', 'technology'] },
  { title: 'Dietitians and Nutritionists', edu: 'BS', outlook: 'A', wage: 60740, interestTags: ['healthcare', 'food', 'science', 'nutrition'], subjectTags: ['science', 'biology', 'health', 'math'] },
  { title: 'Recreational Therapists', edu: 'BS', outlook: 'BA', wage: 45060, interestTags: ['healthcare', 'sports', 'social'], subjectTags: ['health', 'social'] },
  { title: 'Occupational Health and Safety Specialists', edu: 'BS', outlook: 'A', wage: 71570, interestTags: ['healthcare', 'safety', 'science'], subjectTags: ['science', 'health', 'social'] },
  { title: 'Social and Community Service Managers', edu: 'BS', outlook: 'AA', wage: 53360, interestTags: ['social', 'community', 'business'], subjectTags: ['social', 'business', 'english'] },
  { title: 'Medical and Health Services Managers', edu: 'BS', outlook: 'AA', wage: 88340, interestTags: ['healthcare', 'business', 'management'], subjectTags: ['health', 'business', 'social'] },
  { title: 'Web Developers', edu: 'BS', outlook: 'AA', wage: 43530, interestTags: ['technology', 'computers', 'coding', 'design'], subjectTags: ['math', 'technology', 'art', 'computer'] },
  { title: 'Web and Digital Interface Designers', edu: 'BS', outlook: 'A', wage: 57020, interestTags: ['design', 'technology', 'art', 'computers'], subjectTags: ['art', 'technology', 'computer'] },
  { title: 'Graphic Designers', edu: 'BS', outlook: 'BA', wage: 46430, interestTags: ['art', 'design', 'communications'], subjectTags: ['art', 'technology'] },
  { title: 'Writers and Authors', edu: 'BS', outlook: 'BA', wage: 46490, interestTags: ['communications', 'art', 'writing'], subjectTags: ['english', 'social', 'art'] },
  { title: 'Logisticians', edu: 'BS', outlook: 'AA', wage: 73710, interestTags: ['business', 'logistics', 'technology'], subjectTags: ['math', 'business', 'technology'] },
  { title: 'Management Analysts', edu: 'BS', outlook: 'A', wage: 72550, interestTags: ['business', 'management', 'technology'], subjectTags: ['math', 'business', 'social'] },
  { title: 'Training and Development Managers', edu: 'BS', outlook: 'A', wage: 90890, interestTags: ['education', 'business', 'management'], subjectTags: ['english', 'social', 'business'] },
  { title: 'Network and Computer Systems Administrators', edu: 'BS', outlook: 'A', wage: 79040, interestTags: ['technology', 'computers', 'IT'], subjectTags: ['math', 'technology', 'computer'] },
  { title: 'Chief Executives', edu: 'BS', outlook: 'BA', wage: 121220, interestTags: ['business', 'management', 'leadership'], subjectTags: ['business', 'math', 'social'] },
  { title: 'Personal Financial Advisors', edu: 'BS', outlook: 'AA', wage: 75150, interestTags: ['finance', 'business', 'management'], subjectTags: ['math', 'business'] },
  { title: 'Natural Sciences Managers', edu: 'BS', outlook: 'BA', wage: 134430, interestTags: ['science', 'management', 'research'], subjectTags: ['science', 'biology', 'math'] },
];

// Maps RIASEC codes to career interest tag categories
const RIASEC_TO_CAREER_TAGS: Record<string, string[]> = {
  R: ['trades', 'construction', 'agriculture', 'manufacturing', 'environment', 'automotive', 'electrical'],
  I: ['science', 'technology', 'engineering', 'research', 'data', 'coding', 'math'],
  A: ['art', 'design', 'writing', 'communications', 'culinary'],
  S: ['social', 'education', 'healthcare', 'community', 'nursing', 'therapy', 'children'],
  E: ['business', 'law', 'management', 'sales', 'marketing', 'leadership'],
  C: ['business', 'finance', 'data', 'technology', 'logistics', 'government'],
};

// Maps onboarding strength selections to career interest tag categories
const STRENGTH_TO_CAREER_TAGS: Record<string, string[]> = {
  'Solving problems':          ['technology', 'engineering', 'business', 'law'],
  'Helping others':            ['social', 'education', 'healthcare', 'community'],
  'Working with my hands':     ['trades', 'construction', 'agriculture', 'manufacturing'],
  'Connecting with people':    ['business', 'social', 'education', 'communications'],
  'Creating art':              ['art', 'design', 'technology', 'business'],
  'Learning new things':       ['science', 'technology', 'education'],
  'Sharing what I know':       ['education', 'business', 'social'],
  'Exploring and adventuring': ['science', 'environment', 'agriculture', 'law'],
  'Taking care of people':     ['healthcare', 'social', 'education'],
  'Leading others':            ['business', 'education', 'law', 'management'],
  'Growing and building things': ['agriculture', 'trades', 'business', 'science'],
  'Working with numbers':      ['finance', 'technology', 'science', 'engineering'],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatWage(wage: number | null): string {
  if (wage === null) return 'N/A';
  return `$${wage.toLocaleString()}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function extractStudentTags(student: Student): Set<string> {
  const text = [
    student.interests ?? '',
    student.career_goals ?? '',
    student.specific_career_interest ?? '',
    ...(student.post_secondary_plans ?? []),
  ].join(' ').toLowerCase();

  const words = text.split(/[\s,;.!?()\-]+/).filter(w => w.length > 2);
  const tags = new Set<string>();
  for (const word of words) {
    const mapped = KEYWORD_TO_TAGS[word];
    if (mapped) mapped.forEach(t => tags.add(t));
  }

  // Add tags from onboarding strength selections
  for (const strength of student.strengths ?? []) {
    const strengthTags = STRENGTH_TO_CAREER_TAGS[strength];
    if (strengthTags) strengthTags.forEach(t => tags.add(t));
  }

  return tags;
}

function extractRiasecTags(student: Student): Set<string> {
  const tags = new Set<string>();
  for (const code of student.riasec_codes ?? []) {
    const codeTags = RIASEC_TO_CAREER_TAGS[code];
    if (codeTags) codeTags.forEach(t => tags.add(t));
  }
  return tags;
}

function subjectMatchesTag(subjectName: string, tag: string): boolean {
  const s = subjectName.toLowerCase();
  const aliases = SUBJECT_ALIASES[tag] ?? [tag];
  return aliases.some(a => s.includes(a) || (a.length > 4 && a.includes(s)));
}

// ── Core matching functions ──────────────────────────────────────────────────

export function matchCareers(
  student: Student,
  weeklyGrades: WeeklyClassGrade[],
  classes: ClassRecord[]
): ScoredCareer[] {
  const studentTags = extractStudentTags(student);
  const riasecTags = extractRiasecTags(student);
  const plans = (student.post_secondary_plans ?? []).join(' ').toLowerCase();

  // Top 2 performing subjects by average grade
  const classAverages = classes
    .map(cls => {
      const grades = weeklyGrades
        .filter(g => g.class_id === cls.id && g.grade_points != null)
        .map(g => g.grade_points!);
      const avg = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : 0;
      return { subject: (cls.subject || cls.name).toLowerCase(), avg };
    })
    .sort((a, b) => b.avg - a.avg);
  const topSubjects = classAverages.slice(0, 2).map(c => c.subject);

  const getEducationScore = (edu: 'HS' | 'AS' | 'BS'): number => {
    if (edu === 'BS' && (plans.includes('4-year') || plans.includes('bachelor') || plans.includes('university'))) return 1;
    if (edu === 'AS' && (plans.includes('2-year') || plans.includes('associate') || plans.includes('community'))) return 1;
    if (edu === 'HS' && (plans.includes('trade') || plans.includes('vocational') || plans.includes('straight') || plans.includes('military'))) return 1;
    return 0;
  };

  const scored: ScoredCareer[] = CAREERS.map(career => {
    // Interest match (50%) — RIASEC matches weighted 1.4×, keyword-only matches 1.0×
    const riasecMatchTags = career.interestTags.filter(tag => riasecTags.has(tag));
    const keywordOnlyMatchTags = career.interestTags.filter(tag => studentTags.has(tag) && !riasecTags.has(tag));
    const interestMatches = [...riasecMatchTags, ...keywordOnlyMatchTags];
    const weightedCount = riasecMatchTags.length * 1.4 + keywordOnlyMatchTags.length * 1.0;
    const interestScore = weightedCount > 0
      ? Math.min(1, weightedCount / Math.max(1, career.interestTags.length * 0.5))
      : 0;

    // Subject strength match (30%)
    const subjectMatches = topSubjects.length > 0
      ? career.subjectTags.filter(tag => topSubjects.some(s => subjectMatchesTag(s, tag)))
      : [];
    const subjectScore = subjectMatches.length > 0 ? 1 : 0;

    // Education alignment (20%)
    const educationScore = getEducationScore(career.edu);

    const score = interestScore * 0.5 + subjectScore * 0.3 + educationScore * 0.2;

    // Build match reason
    const reasonParts: string[] = [];
    if (interestMatches.length > 0) {
      const display = interestMatches.slice(0, 2).map(capitalize).join(' and ');
      reasonParts.push(`Matches your ${display} interest`);
    }
    if (subjectMatches.length > 0 && topSubjects.length > 0) {
      const subjectDisplay = capitalize(topSubjects[0]);
      if (reasonParts.length > 0) {
        reasonParts.push(`aligns with your ${subjectDisplay} strength`);
      } else {
        reasonParts.push(`Aligns with your ${subjectDisplay} strength`);
      }
    }

    let matchReason: string;
    if (reasonParts.length > 0) {
      matchReason = reasonParts.join(', ');
    } else if (educationScore > 0) {
      const planLabel =
        career.edu === 'BS' ? '4-year college' :
        career.edu === 'AS' ? '2-year college' :
        'hands-on career';
      matchReason = `A strong fit for your ${planLabel} path`;
    } else {
      matchReason = 'A growing career field in Arkansas worth exploring';
    }

    return { ...career, score, matchReason, interestMatches, subjectMatches };
  });

  return scored
    .sort((a, b) => b.score - a.score || (b.wage ?? 0) - (a.wage ?? 0))
    .slice(0, 5);
}

function getGrowingCareers(): Career[] {
  return [...CAREERS]
    .filter(c => c.wage !== null)
    .sort((a, b) => {
      // bright_outlook DESC: AA = true, others = false
      const aBO = a.outlook === 'AA' ? 1 : 0;
      const bBO = b.outlook === 'AA' ? 1 : 0;
      if (bBO !== aBO) return bBO - aBO;
      // job_outlook ASC (AA=0, A=1, BA=2, D=3)
      const oPriority = OUTLOOK_PRIORITY[a.outlook] - OUTLOOK_PRIORITY[b.outlook];
      if (oPriority !== 0) return oPriority;
      // wage DESC
      return (b.wage ?? 0) - (a.wage ?? 0);
    })
    .slice(0, 5);
}

// ── Badge components ──────────────────────────────────────────────────────────

function EduBadge({ edu }: { edu: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    HS:  { bg: '#E8F4F0', text: '#1C7D6B' },
    AS:  { bg: '#EAF2FF', text: '#2563EB' },
    BS:  { bg: '#F3E8FF', text: '#7C3AED' },
  };
  const style = colors[edu] ?? { bg: '#F0FAF8', text: '#1C7D6B' };
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: style.bg, color: style.text }}
    >
      {EDU_BADGE[edu] ?? edu}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const isPublic = type === 'Public';
  const bg = isPublic ? '#EAF2FF' : type === 'Private Nonprofit' ? '#FFF8E1' : '#FEF2F2';
  const color = isPublic ? '#1D4ED8' : type === 'Private Nonprofit' ? '#92400E' : '#991B1B';
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: bg, color }}
    >
      {type}
    </span>
  );
}

function SizeBadge({ size }: { size: string }) {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: '#F0FAF8', color: 'var(--color-primary)' }}
    >
      {size}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface CareerCornerProps {
  student: Student;
  weeklyGrades: WeeklyClassGrade[];
  classes: ClassRecord[];
  school: School | null;
  activeYear: string;
  onOpenProfile?: () => void;
}

export default function CareerCorner({
  student, weeklyGrades, classes, school, activeYear, onOpenProfile,
}: CareerCornerProps) {
  const filteredGrades = useMemo(
    () => weeklyGrades.filter(g => g.school_year === activeYear),
    [weeklyGrades, activeYear]
  );

  const growingCareers = useMemo(() => getGrowingCareers(), []);
  const careerMatches = useMemo(() => matchCareers(student, filteredGrades, classes), [student, filteredGrades, classes]);

  const [colleges, setColleges] = useState<LiveCollege[]>([]);
  const [collegesLoading, setCollegesLoading] = useState(false);
  const [collegesError, setCollegesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchColleges = async () => {
      setCollegesLoading(true);
      setCollegesError(null);
      try {
        const response = await fetch('/.netlify/functions/college-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postSecondaryPlans: student.post_secondary_plans,
            interests: student.interests,
            topCareers: careerMatches,
            collegeProximity: student.college_proximity_preference,
          }),
        });
        if (!response.ok) throw new Error('College data unavailable');
        const data = await response.json();
        if (!cancelled) setColleges(data.colleges ?? []);
      } catch (err: any) {
        if (!cancelled) setCollegesError(err.message ?? 'Unable to load college data');
      } finally {
        if (!cancelled) setCollegesLoading(false);
      }
    };
    fetchColleges();
    return () => { cancelled = true; };
  }, [student.id, careerMatches]);

  const hasProfile = !!(
    (student.post_secondary_plans?.length ?? 0) > 0 ||
    student.interests?.trim() ||
    (student.strengths?.length ?? 0) > 0 ||
    student.specific_career_interest?.trim()
  );

  return (
    <div className="mt-8">
      {/* Section header */}
      <div className="mb-6 flex items-center gap-3">
        <span className="text-3xl leading-none" role="img" aria-hidden="true">🧭</span>
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>Your Next Chapter</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Your future, informed by real Arkansas data</p>
        </div>
      </div>

      {/* Empty state — no profile data yet */}
      {!hasProfile && onOpenProfile && (
        <div
          className="mb-6 flex flex-col items-center gap-4 rounded-[2rem] px-8 py-10 text-center shadow-sm sm:flex-row sm:text-left"
          style={{ background: 'var(--color-card-tint)', border: '2px dashed rgba(28,125,107,0.3)' }}
        >
          <span className="text-5xl leading-none" role="img" aria-hidden="true">✨</span>
          <div className="flex-1">
            <p className="font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Complete your profile to unlock personalized career and college matches
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Tell us about your goals and interests — it only takes a minute.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenProfile}
            className="shrink-0 rounded-full px-5 py-2.5 text-sm font-bold text-white transition"
            style={{ background: 'var(--color-primary)' }}
          >
            Complete my profile →
          </button>
        </div>
      )}


      {/* Three-card grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

        {/* ── Card 1: Top 5 Growing Careers ── */}
        <div
          className="flex flex-col overflow-hidden rounded-[2rem] shadow-sm"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
        >
          <div className="px-6 py-5" style={{ background: 'var(--color-green-highlight)' }}>
            <p className="text-lg font-bold" style={{ color: '#1a5c44' }}>🌱 Top 5 Growing Careers in Arkansas</p>
            <p className="mt-0.5 text-xs" style={{ color: '#2d7a5e' }}>Based on current Arkansas labor market data</p>
          </div>
          <div className="flex flex-1 flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {growingCareers.map((career, i) => (
              <div key={career.title} className="flex items-start gap-3 px-5 py-4">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: 'var(--color-green-highlight)', color: '#1a5c44' }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--color-text-primary)' }}>
                    {career.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <EduBadge edu={career.edu} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                      {formatWage(career.wage)}/yr
                    </span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {OUTLOOK_LABEL[career.outlook]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Card 2: Top Career Matches ── */}
        <div
          className="flex flex-col overflow-hidden rounded-[2rem] shadow-sm"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
        >
          <div className="px-6 py-5" style={{ background: '#FFFBEB' }}>
            <p className="text-lg font-bold" style={{ color: 'var(--color-accent-dark)' }}>⭐ Your Top Career Matches</p>
            <p className="mt-0.5 text-xs" style={{ color: '#92660a' }}>Based on your strengths, interests, and goals</p>
          </div>
          <div className="flex flex-1 flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {careerMatches.length === 0 ? (
              <p className="px-5 py-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Add your interests and post-secondary plans to see personalized career matches.
              </p>
            ) : careerMatches.map((career, i) => (
              <div key={career.title} className="flex items-start gap-3 px-5 py-4">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: '#FFF3C4', color: 'var(--color-accent-dark)' }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--color-text-primary)' }}>
                    {career.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <EduBadge edu={career.edu} />
                    {career.wage !== null && (
                      <span className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                        {formatWage(career.wage)}/yr
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs italic" style={{ color: 'var(--color-text-secondary)' }}>
                    {career.matchReason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Card 3: College Matches ── */}
        <div
          className="flex flex-col overflow-hidden rounded-[2rem] shadow-sm"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
        >
          <div className="px-6 py-5" style={{ background: 'var(--color-card-tint)' }}>
            <p className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>🎓 College Matches</p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>Arkansas institutions that fit your path</p>
          </div>
          <div className="flex flex-1 flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {collegesLoading ? (
              <div className="space-y-3 px-5 py-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3.5 w-3/4 animate-pulse rounded" style={{ background: 'var(--color-border)' }} />
                    <div className="h-3 w-1/2 animate-pulse rounded" style={{ background: 'var(--color-border)' }} />
                    <div className="h-3 w-2/3 animate-pulse rounded" style={{ background: 'var(--color-border)' }} />
                  </div>
                ))}
              </div>
            ) : collegesError ? (
              <p className="px-5 py-6 text-sm text-rose-600">{collegesError}</p>
            ) : colleges.length === 0 ? (
              <p className="px-5 py-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Add your post-secondary plans to see college matches.
              </p>
            ) : colleges.map((college) => (
              <div key={college.name} className="px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--color-text-primary)' }}>
                      {college.name}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {college.city}
                    </p>
                  </div>
                  {college.url ? (
                    <a
                      href={college.url.startsWith('http') ? college.url : `https://${college.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 shrink-0 rounded-full p-1.5 transition"
                      style={{ color: 'var(--color-primary)', background: 'var(--color-card-tint)' }}
                      aria-label={`Visit ${college.name} website`}
                      title={college.url}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <TypeBadge type={college.type} />
                  <SizeBadge size={college.size} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12V19a2 2 0 002 2h5V3H5a2 2 0 00-2 2v7zm7-9v18h9a2 2 0 002-2V5a2 2 0 00-2-2h-9z" />
                    </svg>
                    {college.admissionRate}
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M7 7h5a2 2 0 010 4H8a2 2 0 000 4h6M7 7a2 2 0 00-2 2v0a2 2 0 002 2" />
                    </svg>
                    {college.netPrice}
                  </span>
                  {college.completionRate && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422A12.083 12.083 0 0121 13.5v5.5M3 13.5v5.5a9 9 0 0018 0" />
                      </svg>
                      {college.completionRate} grad rate
                    </span>
                  )}
                  {college.medianEarnings && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M9 17V9m4 8v-4m4 4V5" />
                      </svg>
                      Grad earnings avg {college.medianEarnings}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs italic" style={{ color: 'var(--color-text-secondary)' }}>
                  {college.matchReason}
                </p>
              </div>
            ))}
          </div>
          <div className="px-5 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Data from U.S. College Scorecard · Updated annually
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
