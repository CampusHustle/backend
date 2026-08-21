import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import Note from '../models/Note.js';

const PASSWORD_PLAIN = 'Password123!';

const SEED_USERS = [
  {
    name: 'Selamawit Bekele',
    email: 'selamawit.bekele@aau.edu.et',
    role: 'student',
    university: 'Addis Ababa University',
    department: 'Computer Science',
    gender: 'female',
    year: 3,
    bio: 'Passionate about algorithms, full-stack web development, and peer mentorship. Let\'s master Data Structures together!',
    hourlyRate: 120,
    skillsTeaching: ['algorithms', 'data structures', 'python', 'javascript'],
    skillsLearning: ['machine learning', 'cloud computing'],
    availability: ['Mon 9:00 AM', 'Wed 2:00 PM', 'Fri 9:00 AM'],
    rating: { knowledge: 4.9, communication: 4.8, punctuality: 5.0, count: 24 },
    isEmailVerified: true,
    isProfileComplete: true,
    notes: [
      {
        title: 'Data Structures & Algorithms in Python: Complete High-Yield Exam Guide',
        course: 'CS 201',
        description: 'Comprehensive 35-page guide covering trees, graphs, dynamic programming, sorting, and big-O runtime analysis with annotated code snippets.',
        price: 150,
        previewPages: 4,
        purchaseCount: 14,
        fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      },
      {
        title: 'Modern Web Development with React & Node.js Master Notes',
        course: 'CS 305',
        description: 'Complete semester study notes on full-stack architecture, REST APIs, asynchronous state management, and authentication workflows.',
        price: 180,
        previewPages: 5,
        purchaseCount: 9,
        fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      }
    ]
  },
  {
    name: 'Dawit Haile',
    email: 'dawit.haile@office.mu.edu.et',
    role: 'student',
    university: 'Mekelle University',
    department: 'Electrical Engineering',
    gender: 'male',
    year: 4,
    bio: '4th-year Electrical Engineering student specializing in circuit analysis, digital logic design, and signal processing.',
    hourlyRate: 140,
    skillsTeaching: ['circuit analysis', 'digital electronics', 'signal processing', 'linear algebra'],
    skillsLearning: ['programming', 'python'],
    availability: ['Tue 9:00 AM', 'Thu 2:00 PM'],
    rating: { knowledge: 5.0, communication: 4.9, punctuality: 4.8, count: 19 },
    isEmailVerified: true,
    isProfileComplete: true,
    notes: [
      {
        title: 'Circuit Analysis & AC Network Theorems Summary Cheat Sheets',
        course: 'EENG 211',
        description: 'Step-by-step solutions for Thevenin, Norton, RLC transient analysis, phasor diagrams, and resonance formulas.',
        price: 120,
        previewPages: 3,
        purchaseCount: 22,
        fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      },
      {
        title: 'Digital Logic Design & Verilog Microprocessor Architectures',
        course: 'EENG 322',
        description: 'In-depth breakdowns of Karnaugh maps, sequential flip-flops, FSM state diagrams, and ALU circuit design.',
        price: 200,
        previewPages: 6,
        purchaseCount: 11,
        fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      }
    ]
  },
  {
    name: 'Bethlehem Girma',
    email: 'bethlehem.girma@hu.edu.et',
    role: 'student',
    university: 'Hawassa University',
    department: 'Economics',
    gender: 'female',
    year: 3,
    bio: 'Economics honor student offering simplified microeconomics, macroeconomics, and statistical analysis tutoring.',
    hourlyRate: 100,
    skillsTeaching: ['statistics', 'probability', 'mathematics'],
    skillsLearning: ['python', 'database systems'],
    availability: ['Mon 2:00 PM', 'Wed 9:00 AM', 'Thu 2:00 PM'],
    rating: { knowledge: 4.8, communication: 5.0, punctuality: 4.9, count: 31 },
    isEmailVerified: true,
    isProfileComplete: true,
    notes: [
      {
        title: 'Macroeconomics Midterm Masterclass & National Accounting Formulas',
        course: 'ECON 202',
        description: 'High-yield summaries of IS-LM model curves, monetary & fiscal policies, inflation rates, and GDP calculations.',
        price: 110,
        previewPages: 4,
        purchaseCount: 35,
        fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      },
      {
        title: 'Applied Business Statistics & Econometrics Problem Sets Solved',
        course: 'STAT 214',
        description: 'Complete solved exercises on hypothesis testing, ANOVA, linear regression, and probability distributions.',
        price: 160,
        previewPages: 5,
        purchaseCount: 18,
        fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      }
    ]
  },
  {
    name: 'Yonas Alemu',
    email: 'yonas.alemu@bdu.edu.et',
    role: 'student',
    university: 'Bahir Dar University',
    department: 'Mechanical Engineering',
    gender: 'male',
    year: 4,
    bio: 'Dedicated tutor with high academic standing in thermodynamics, fluid mechanics, and engineering mathematics.',
    hourlyRate: 130,
    skillsTeaching: ['thermodynamics', 'fluid mechanics', 'calculus', 'mechanics'],
    skillsLearning: ['programming', 'c++'],
    availability: ['Wed 2:00 PM', 'Fri 2:00 PM'],
    rating: { knowledge: 4.9, communication: 4.7, punctuality: 5.0, count: 15 },
    isEmailVerified: true,
    isProfileComplete: true,
    notes: [
      {
        title: 'Thermodynamics I: Laws, Steam Tables & Carnot Cycles Review',
        course: 'MENG 201',
        description: 'Concise reference cheat sheet and solved exam problems on energy conservation, entropy, and Rankine cycles.',
        price: 140,
        previewPages: 4,
        purchaseCount: 8,
        fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      },
      {
        title: 'Fluid Mechanics Fundamentals & Navier-Stokes Equations Guide',
        course: 'MENG 302',
        description: 'High-yield derivations for Bernoulli equation, laminar/turbulent pipe flow, Reynolds numbers, and pump calculations.',
        price: 175,
        previewPages: 5,
        purchaseCount: 12,
        fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      }
    ]
  },
  {
    name: 'Meron Tesfaye',
    email: 'meron.tesfaye@ju.edu.et',
    role: 'student',
    university: 'Jimma University',
    department: 'Mathematics',
    gender: 'female',
    year: 2,
    bio: 'Math enthusiast helping freshmen and sophomores conquer Calculus, Linear Algebra, and Discrete Mathematics.',
    hourlyRate: 110,
    skillsTeaching: ['calculus', 'linear algebra', 'discrete mathematics', 'mathematics'],
    skillsLearning: ['programming', 'python'],
    availability: ['Tue 2:00 PM', 'Thu 9:00 AM'],
    rating: { knowledge: 5.0, communication: 4.9, punctuality: 5.0, count: 28 },
    isEmailVerified: true,
    isProfileComplete: true,
    notes: [
      {
        title: 'Multivariable Calculus III Comprehensive Exam Prep & Vectors',
        course: 'MATH 201',
        description: 'Complete lecture notes covering partial derivatives, multiple integrals, gradient vectors, Green\'s & Stokes\' theorems.',
        price: 135,
        previewPages: 5,
        purchaseCount: 40,
        fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      },
      {
        title: 'Linear Algebra: Matrices, Eigenvalues & Vector Spaces Cheat Sheet',
        course: 'MATH 205',
        description: 'Quick reference formulas for determinant properties, matrix diagonalization, Gram-Schmidt orthogonalization, and linear transformations.',
        price: 125,
        previewPages: 3,
        purchaseCount: 26,
        fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      }
    ]
  }
];

async function seed() {
  console.log('Connecting to database:', config.databaseUrl);
  await mongoose.connect(config.databaseUrl);

  const passwordHash = await bcrypt.hash(PASSWORD_PLAIN, 10);

  for (const item of SEED_USERS) {
    const { notes, ...userData } = item;

    // Upsert User
    let user = await User.findOne({ email: userData.email });
    if (!user) {
      user = await User.create({
        ...userData,
        passwordHash
      });
      console.log(`Created user: ${user.name} (${user.email})`);
    } else {
      Object.assign(user, userData, { passwordHash });
      await user.save();
      console.log(`Updated user: ${user.name} (${user.email})`);
    }

    // Upsert Notes for this user
    for (const noteData of notes) {
      let note = await Note.findOne({ tutorId: user._id, title: noteData.title });
      if (!note) {
        note = await Note.create({
          ...noteData,
          tutorId: user._id
        });
        console.log(`  Created note: "${note.title}" for ${user.name}`);
      } else {
        Object.assign(note, noteData);
        await note.save();
        console.log(`  Updated note: "${note.title}" for ${user.name}`);
      }
    }
  }

  console.log('Seed completed successfully!');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
