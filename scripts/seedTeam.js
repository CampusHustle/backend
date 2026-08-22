import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { config } from '../config/env.js';

const dbUrl = config.databaseUrl || process.env.DATABASE_URL || 'mongodb://localhost:27017/campus_hustle';

const teamMembers = [
  {
    name: 'Beimenet',
    email: 'beimenet@ch.edu.et',
    password: process.env.BEIMENET_PASSWORD || '12211221',
    gender: 'female',
    university: 'Campus Hustle University',
    department: 'Computer Science',
    year: 3,
    bio: 'Software enthusiast and tech lead. Skilled in full stack engineering and UI/UX design.',
    skillsTeaching: ['Python', 'Web Development', 'UI/UX Design', 'Data Structures'],
    skillsLearning: ['Machine Learning', 'Cloud Architecture'],
    isEmailVerified: true,
    isProfileComplete: true,
    role: 'student'
  },
  {
    name: 'Chara',
    email: 'chara@ch.edu.et',
    password: process.env.CHARA_PASSWORD || 'charaychlal11',
    gender: 'male',
    university: 'Campus Hustle University',
    department: 'Software Engineering',
    year: 3,
    bio: 'Passionate software developer specializing in backend systems, APIs, and React.',
    skillsTeaching: ['JavaScript', 'React', 'Node.js', 'Express', 'MongoDB'],
    skillsLearning: ['DevOps', 'Distributed Systems'],
    isEmailVerified: true,
    isProfileComplete: true,
    role: 'student'
  }
];

async function seedDatabase(url) {
  const safeUrl = url.replace(/:([^@]+)@/, ':****@');
  console.log(`Connecting to: ${safeUrl}...`);
  try {
    const conn = await mongoose.createConnection(url, { serverSelectionTimeoutMS: 8000 }).asPromise();
    const UserModel = conn.model('User', User.schema);

    for (const member of teamMembers) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(member.password, salt);

      const updateData = {
        name: member.name,
        email: member.email.toLowerCase(),
        passwordHash,
        gender: member.gender,
        university: member.university,
        department: member.department,
        year: member.year,
        bio: member.bio,
        skillsTeaching: member.skillsTeaching,
        skillsLearning: member.skillsLearning,
        isEmailVerified: true,
        isProfileComplete: true,
        role: member.role,
        isBlocked: false,
      };

      const user = await UserModel.findOneAndUpdate(
        { email: member.email.toLowerCase() },
        { $set: updateData },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      console.log(`✅ Created/Updated user: ${user.name} (${user.email})`);
    }

    await conn.close();
    console.log('Database operation successful!\n');
    return true;
  } catch (err) {
    console.error(`❌ Connection failed for ${safeUrl}:`, err.message);
    return false;
  }
}

async function run() {
  console.log('=== SEEDING TEAM MEMBERS ===\n');
  await seedDatabase(dbUrl);
  process.exit(0);
}

run();
