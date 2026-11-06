import FinanceInvoice from '../models/Invoice.js';
import financeRoutes from './financeRoutes.js';
import DriverAccount from '../models/Driver.js';
import ParentAccount from '../models/Parent.js';
import ChildAccount from '../models/Child.js';
import { instituteMapData } from './mapData.js';
import { assignEnrolledStudent } from './enrollment.js';
import enrollmentRoutes from './enrollmentRoutes.js';
import crypto from 'crypto';
import { validCampusLocation } from './campusLocation.js';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import { readStore, writeStore } from './store.js';
import { linkRecord, refreshLinkedRecords } from './sharedRecords.js';
import rateLimit from 'express-rate-limit';
import Institute from './models/Institute.js';
import Record from './models/Record.js';
import { createDemoEnquiryHandler } from './handlers/demoEnquiries.js';

// Mounted by the existing ASAN server; never creates a database connection or listener.
const app = express.Router();
const sessionSecret = process.env.INSTITUTE_SESSION_SECRET || process.env.JWT_SECRET;
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_MAX_AGE_MS = 15 * 60 * 1000;
async function connectMongo() {
  if (mongoose.connection.readyState !== 1) throw new Error('Shared ASAN database is unavailable.');
}

const allowedModules = new Set([
  'Live tracking', 'Trips', 'Routes', 'Vehicles', 'Drivers', 'Maintenance', 'Documents',
  'Students', 'Parents', 'Attendance', 'Payments', 'Fees', 'Invoices', 'Receipts',
  'Refunds', 'Notifications', 'Complaints', 'Emergency', 'Reports', 'Performance', 'Settings'
]);


app.use(express.json({ limit: '1mb' }));
app.use('/', async (req, res, next) => {
  try {
    await ensureMongoConnection();
    next();
  } catch {
    res.status(503).json({ message: 'Database connection is temporarily unavailable. Please try again.' });
  }
});

function createSessionToken(userId) {
  const payload = Buffer.from(JSON.stringify({
    sub: String(userId),
    exp: Date.now() + SESSION_MAX_AGE_MS
  })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', sessionSecret)
    .update('institute:' + payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

function getPublicAppUrl() {
  const configuredUrl = process.env.INSTITUTE_APP_URL || 'https://asan-rides-institute.vercel.app';
  return new URL(configuredUrl).origin;
}

async function sendPasswordResetEmail({ email, name, resetUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PASSWORD_RESET_FROM_EMAIL || 'ASAN Rides <security@asanrides.com>';
  if (!apiKey) throw new Error('Password reset email is not configured.');

  const safeName = String(name || 'there').replace(/[<>&"']/g, '');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Reset your ASAN Institute password',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a">
          <h2>Reset your ASAN Institute password</h2>
          <p>Hello ${safeName},</p>
          <p>Use the button below to choose a new password. This link expires in 15 minutes.</p>
          <p style="margin:28px 0"><a href="${resetUrl}" style="background:#ffd400;color:#0f172a;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px">Reset password</a></p>
          <p>If you did not request this change, you can safely ignore this email.</p>
        </div>`
    })
  });

  if (!response.ok) {
    const details = await response.text();
    console.error('Password reset email failed:', response.status, details);
    throw new Error('Unable to send the password reset email.');
  }
}

async function getSession(req) {
  if (!sessionSecret) return null;
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  const expected = crypto
    .createHmac('sha256', sessionSecret)
    .update('institute:' + payload)
    .digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!session.sub || !session.exp || session.exp <= Date.now()) return null;
    const user = await User.findById(session.sub).lean();
    if (!user) return null;
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      instituteName: user.instituteName || '',
      instituteCode: user.role === 'Institute Admin' ? (user.instituteCode || '') : '',
      instituteLocation: user.instituteLocation || null
    };
  } catch {
    return null;
  }
}

async function requireSession(req, res, next) {
  const user = await getSession(req);
  if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  if (!user.instituteName) return res.status(403).json({ message: 'An institute membership is required.' });
  req.user = user;
  if (!['GET', 'HEAD'].includes(req.method) && user.role === 'Viewer' && !['/auth/sign-out','/auth/change-password'].includes(req.path)) return res.status(403).json({ message: 'Viewers have read-only access.' });
  next();
}

function requireModule(req, res, next) {
  if (req.params.module === 'Settings' && !['GET','HEAD'].includes(req.method) && req.user.role !== 'Institute Admin') return res.status(403).json({ message: 'Only the Institute Admin can change settings.' });
  if (!allowedModules.has(req.params.module)) return res.status(404).json({ message: 'Unknown module.' });
  next();
}

async function ensureMongoConnection() {
  await connectMongo();
}

function recordInstitute(req) {
  return req.user?.instituteName || '';
}

async function getModuleRecords(module, instituteName) {
  const records = await Record.find({ module, instituteName }).sort({ createdAt: -1 }).lean();
  return refreshLinkedRecords(module, records, instituteName);
}

async function buildDashboard(req) {
  await ensureMongoConnection();
  const userInstitute = req?.user?.instituteName || '';
  const moduleNames = [
    'Settings', 'Vehicles', 'Drivers', 'Students', 'Routes', 'Trips', 'Payments',
    'Emergency', 'Live tracking', 'Attendance'
  ];
  const moduleRecords = await Promise.all(
    moduleNames.map(async (module) => [module, await getModuleRecords(module, userInstitute)])
  );
  const records = Object.fromEntries(moduleRecords);

  const vehicles = records.Vehicles || [];
  const drivers = records.Drivers || [];
  const students = records.Students || [];
  const routes = records.Routes || [];
  const trips = records.Trips || [];
  const payments = records.Payments || [];
  const emergency = records.Emergency || [];
  const liveTracking = records['Live tracking'] || [];
  const attendance = records.Attendance || [];

  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter(v => ['Active', 'On trip', 'Available'].includes(v.data?.['Vehicle status'])).length;
  const vehiclesMaintenance = vehicles.filter(v => v.data?.['Vehicle status'] === 'Maintenance').length;
  const vehiclesRunning = liveTracking.filter(t => ['Started', 'On route'].includes(t.data?.['Trip status'])).length;
  const delayedVehicles = liveTracking.filter(t => t.data?.['Trip status'] === 'Delayed' || t.deviated).length;

  const totalDrivers = drivers.length;
  const driversOnDuty = drivers.filter(d => d.data?.Status === 'On duty' || d.data?.['Driver status'] === 'On duty').length;

  const studentsUsingTransport = students.filter(s => s.data?.['Transportation status'] === 'Active' || s.data?.['Transport status'] === 'Active').length;
  const activeRoutes = routes.length;
  const todayTrips = trips.length;

  const studentsPickedUp = attendance.filter(a => a.data?.['Pickup status'] === 'Picked up').length;
  const studentsDropped = attendance.filter(a => a.data?.['Drop status'] === 'Dropped').length;

  const completedTrips = trips.filter(t => t.data?.['Trip status'] === 'Completed').length;
  const cancelledTrips = trips.filter(t => t.data?.['Trip status'] === 'Cancelled').length;
  const vehiclesOffline = Math.max(0, totalVehicles - vehiclesRunning - vehiclesMaintenance);
  const activeEmergencyAlerts = emergency.filter(e => e.data?.Status === 'Responding' || e.data?.Status === 'Open').length;

  // Use the same verified invoices paid through the Parent app.
  const bills = await FinanceInvoice.find({ instituteName: userInstitute, billingSource: 'institute_fixed' }).select('totalAmount status paymentStatus paidAt dueDate').lean();
  const amount = bill => Number(bill.totalAmount || 0);
  const paid = bill => bill.status === 'Paid' && bill.paymentStatus === 'Success';
  const outstanding = bill => ['Pending', 'Overdue', 'Processing'].includes(bill.status);
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const totalFees = bills.filter(bill => bill.status !== 'Cancelled').reduce((sum, bill) => sum + amount(bill), 0);
  const collectedAmount = bills.filter(paid).reduce((sum, bill) => sum + amount(bill), 0);
  const pendingAmount = bills.filter(outstanding).reduce((sum, bill) => sum + amount(bill), 0);
  const overdueAmount = bills.filter(bill => outstanding(bill) && new Date(bill.dueDate) < new Date()).reduce((sum, bill) => sum + amount(bill), 0);
  const todayRevenue = bills.filter(bill => paid(bill) && bill.paidAt && new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(bill.paidAt)) === todayStr).reduce((sum, bill) => sum + amount(bill), 0);

  // Compute alerts dynamically from live records
  const alerts = [];
  liveTracking.forEach(item => {
    if (item.deviated) {
      alerts.push({
        id: `alt-dev-${item.id}`,
        type: 'Route deviation',
        severity: 'critical',
        title: `ALERT: Vehicle deviated from ${item.data?.Route || 'assigned route'}`,
        detail: `Vehicle ${item.data?.['Vehicle number']} deviated from designated path.`,
        time: 'Just now',
        actionText: 'Locate vehicle',
        actionModule: 'Live tracking'
      });
    }
  });

  emergency.filter(e => e.data?.Status === 'Responding' || e.data?.Status === 'Open').forEach(e => {
    alerts.push({
      id: `alt-emg-${e.id}`,
      type: 'Emergency alert',
      severity: 'critical',
      title: `EMERGENCY: ${e.data?.['Emergency type'] || 'Incident Reported'}`,
      detail: `Vehicle ${e.data?.Vehicle || 'Fleet'} reported emergency at ${e.data?.['Current location'] || 'location'}.`,
      time: 'Immediate',
      actionText: 'Open Emergency Desk',
      actionModule: 'Safety'
    });
  });

  let instituteLocation = req?.user?.instituteLocation || null;
  if (!instituteLocation && (userInstitute || req?.user?.instituteCode)) {
    try {
      const inst = await Institute.findOne({
        $or: [
          ...(req?.user?.instituteCode ? [{ code: req.user.instituteCode }] : []),
          ...(userInstitute ? [{ name: userInstitute }] : [])
        ]
      });
      if (inst && inst.location) {
        instituteLocation = inst.location;
      }
    } catch (e) {
      console.error('Error fetching institute location for dashboard:', e);
    }
  }

  return {
    institute: userInstitute,
    instituteCode: req?.user?.role === 'Institute Admin' ? (req?.user?.instituteCode || '') : '',
    instituteLocation: instituteLocation || null,
    brand: 'Asanrides',
    dateLabel: new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()),
    kpiCards: {
      totalVehicles,
      activeVehicles,
      vehiclesUnderMaintenance: vehiclesMaintenance,
      totalDrivers,
      driversOnDuty,
      studentsUsingTransport,
      activeRoutes,
      todayTrips,
      studentsPickedUp,
      studentsDropped,
      pendingPayments: `₹${pendingAmount.toLocaleString('en-IN')}`,
      todayRevenue: `₹${todayRevenue.toLocaleString('en-IN')}`,
      totalFees: `₹${totalFees.toLocaleString('en-IN')}`,
      collectedAmount: `₹${collectedAmount.toLocaleString('en-IN')}`,
      overdueAmount: `₹${overdueAmount.toLocaleString('en-IN')}`
    },
    operationalStatus: {
      vehiclesRunning,
      delayedVehicles,
      completedTrips,
      cancelledTrips,
      vehiclesOffline,
      emergencyAlerts: activeEmergencyAlerts
    },
    liveVehicles: liveTracking.map(item => ({ id: item.id, ...item.data, deviated: item.deviated, deviationAlert: item.deviationAlert })),
    todayTripsList: trips.map(item => ({ id: item.id, ...item.data })),
    alerts
  };
}

// Public intake only. Contact details are viewed privately in MongoDB Atlas.
app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/institutes/verify', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }));
app.post('/demo-enquiries', createDemoEnquiryHandler());

app.get('/health', (_req, res) => res.json({ status: 'ok', brand: 'Asanrides' }));

app.get('/institutes', async (_req, res) => {
  try {
    // Only return institutes that are genuinely registered in the database
    const registeredUserInstitutes = await User.distinct('instituteName');
    const institutes = await Institute.find({
      name: { $in: registeredUserInstitutes }
    }, 'name location').sort({ name: 1 });
    res.json({
      institutes: institutes.map((i) => i.name),
      instituteDetails: institutes.map((i) => ({
        name: i.name,
        location: i.location || null
      }))
    });
  } catch (err) {
    console.error('Error fetching institutes:', err);
    res.json({ institutes: [], instituteDetails: [] });
  }
});

app.get('/institutes/verify/:code', async (req, res) => {
  try {
    const code = req.params.code?.toUpperCase()?.trim();
    if (!code) return res.status(400).json({ valid: false, message: 'Access code is required.' });
    const inst = await Institute.findOne({ code });
    if (!inst) {
      return res.status(404).json({ valid: false, message: 'Invalid Institute Access Code.' });
    }
    res.json({
      valid: true,
      name: inst.name,
      location: inst.location || null
    });
  } catch (err) {
    console.error('Error verifying institute code:', err);
    res.status(500).json({ valid: false, message: 'Server error verifying access code.' });
  }
});

app.get('/auth/status', (_req, res) => {
  res.json({
    configured: true,
    roles: ['Institute Admin', 'Transport Manager', 'Accounts/Admin Staff', 'Viewer']
  });
});

app.post('/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role, instituteName, instituteCode, instituteLocation } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Full name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email address already exists.' });
    }

    const validRoles = ['Institute Admin', 'Transport Manager', 'Accounts/Admin Staff', 'Viewer'];
    const assignedRole = validRoles.includes(role) ? role : 'Institute Admin';

    let assignedInstituteName = '';
    let assignedInstituteCode = '';
    let assignedInstituteLocation = null;

    if (assignedRole === 'Institute Admin') {
      if (!validCampusLocation(instituteLocation)) return res.status(400).json({ message: 'Select and confirm your institute location on the map.' });
      if (!instituteName || !instituteName.trim()) {
        return res.status(400).json({ message: 'Please write your Institute / School name.' });
      }
      assignedInstituteName = instituteName.trim();

      // Check if institute already exists
      let inst = await Institute.findOne({
        name: { $regex: new RegExp(`^${assignedInstituteName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
      });
      if (inst) {
        return res.status(409).json({ message: 'This institute already has an administrator. Join using its private access code.' });
      } else {
        // Generate unique access code e.g. ASAN-738291
        assignedInstituteCode = `ASAN-${Math.floor(100000 + Math.random() * 900000)}`;
        const locObj = (validCampusLocation(instituteLocation)) ? {
          lat: Number(instituteLocation.lat),
          lng: Number(instituteLocation.lng),
          address: instituteLocation.address || ''
        } : { lat: 12.9716, lng: 77.6245, address: '' };

        inst = await Institute.create({
          name: assignedInstituteName,
          code: assignedInstituteCode,
          adminEmail: normalizedEmail,
          location: locObj
        });
        assignedInstituteLocation = inst.location;
      }
    } else if (assignedRole === 'Transport Manager' || assignedRole === 'Accounts/Admin Staff') {
      if (!instituteCode || !instituteCode.trim()) {
        return res.status(400).json({ message: 'Institute Access Code is required to join. Ask your Institute Admin for the code.' });
      }
      const inst = await Institute.findOne({ code: instituteCode.toUpperCase().trim() });
      if (!inst) {
        return res.status(400).json({ message: 'Invalid Institute Access Code. Please ask your Institute Admin for the code.' });
      }
      assignedInstituteName = inst.name;
      assignedInstituteCode = inst.code;
      assignedInstituteLocation = inst.location || null;
    } else if (assignedRole === 'Viewer') {
      if (!instituteName || !instituteName.trim()) {
        return res.status(400).json({ message: 'Please select an existing registered institute.' });
      }
      if (!instituteCode || !instituteCode.trim()) {
        return res.status(400).json({ message: 'Institute Access Code is required to view this institute.' });
      }
      const inst = await Institute.findOne({ name: instituteName.trim() });
      if (!inst || inst.code !== instituteCode.toUpperCase().trim()) {
        return res.status(400).json({ message: 'Incorrect Access Code for the selected institute.' });
      }
      assignedInstituteName = inst.name;
      assignedInstituteCode = inst.code;
      assignedInstituteLocation = inst.location || null;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: assignedRole,
      instituteName: assignedInstituteName,
      instituteCode: assignedInstituteCode,
      instituteLocation: assignedInstituteLocation,
      lastLogin: new Date()
    });

    const token = createSessionToken(newUser._id);
    const userPayload = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      instituteName: newUser.instituteName || '',
      instituteCode: newUser.role === 'Institute Admin' ? (newUser.instituteCode || '') : '',
      instituteLocation: newUser.instituteLocation || null
    };

    res.status(201).json({ token, user: userPayload });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: err.message || 'Internal server error during registration.' });
  }
});

app.post('/auth/sign-in', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    user.lastLogin = new Date();
    await user.save();

    let userInstLocation = user.instituteLocation || null;
    if (!userInstLocation && (user.instituteCode || user.instituteName)) {
      try {
        const inst = await Institute.findOne({
          $or: [
            ...(user.instituteCode ? [{ code: user.instituteCode }] : []),
            ...(user.instituteName ? [{ name: user.instituteName }] : [])
          ]
        });
        if (inst && inst.location) {
          userInstLocation = inst.location;
        }
      } catch (e) {
        console.error('Error fetching institute location for signin:', e);
      }
    }

    const token = createSessionToken(user._id);
    const userPayload = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      instituteName: user.instituteName || '',
      instituteCode: user.role === 'Institute Admin' ? (user.instituteCode || '') : '',
      instituteLocation: userInstLocation
    };

    res.json({ token, user: userPayload });
  } catch (err) {
    console.error('Sign-in error:', err);
    res.status(500).json({ message: err.message || 'Internal server error during sign in.' });
  }
});

app.post('/auth/forgot-password', async (req, res) => {
  const genericMessage = 'If an account exists for this email, a reset link has been sent.';
  try {
    const email = String(req.body?.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ message: 'Email address is required.' });

    const user = await User.findOne({ email });
    if (!user) return res.json({ message: genericMessage });

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_MAX_AGE_MS);
    await user.save();

    const resetUrl = `${getPublicAppUrl()}/?reset=${encodeURIComponent(resetToken)}`;
    try {
      await sendPasswordResetEmail({ email: user.email, name: user.name, resetUrl });
    } catch (emailError) {
      user.passwordResetTokenHash = '';
      user.passwordResetExpiresAt = null;
      await user.save();
      console.error('Password reset delivery unavailable:', emailError.message);
      return res.json({ message: genericMessage });
    }

    res.json({ message: genericMessage });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Unable to start password recovery. Please try again.' });
  }
});

app.post('/auth/reset-password', async (req, res) => {
  try {
    const token = String(req.body?.token || '');
    const password = String(req.body?.password || '');
    if (!token || !password) return res.status(400).json({ message: 'Reset token and new password are required.' });
    if (password.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters long.' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() }
    });
    if (!user) return res.status(400).json({ message: 'This reset link is invalid or has expired.' });

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetTokenHash = '';
    user.passwordResetExpiresAt = null;
    await user.save();
    res.json({ message: 'Password changed successfully. You can now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Unable to change password. Please try again.' });
  }
});

app.post('/auth/change-password', requireSession, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
    }

    const user = await User.findById(req.user.id);
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetTokenHash = '';
    user.passwordResetExpiresAt = null;
    await user.save();
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Unable to change password. Please try again.' });
  }
});

app.use('/enrollment', requireSession, enrollmentRoutes);
app.use('/finance', requireSession, financeRoutes);

app.get('/auth/me', requireSession, async (req, res) => {
  res.json({ user: req.user });
});

app.post('/user/institute', requireSession, (_req, res) => {
  res.status(403).json({ message: 'Institute membership cannot be changed here.' });
});
app.post('/auth/switch-role', requireSession, (req, res) => {
  if (req.body?.role !== req.user.role) return res.status(403).json({ message: 'Role changes require administrator authorization.' });
  res.json({ user: req.user });
});

app.post('/auth/sign-out', requireSession, async (req, res) => {
  res.status(204).end();
});

app.get('/dashboard', requireSession, async (req, res) => {
  try {
    const dashboard = await buildDashboard(req);
    res.json(dashboard);
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ message: 'Error building dashboard' });
  }
});

app.get('/live-map', requireSession, async (req, res) => {
  try { res.json((await instituteMapData(req.user.instituteName)).vehicles); } catch { res.status(503).json({ message: 'Unable to load driver locations.' }); }
});
app.get('/map-points', requireSession, async (req, res) => {
  try { res.json((await instituteMapData(req.user.instituteName)).points); } catch { res.status(503).json({ message: 'Unable to load saved map points.' }); }
});

app.post('/telemetry', requireSession, async (req, res) => {
  const { vehicle, driver, route, latitude, longitude, speed, tripStatus, deviated, nextStop, eta, studentCount } = req.body || {};
  if (!vehicle) return res.status(400).json({ message: 'Vehicle is required.' });

  const store = await readStore(req);
  const records = store.records['Live tracking'] || [];
  const existing = records.find(item => item.data?.['Vehicle number'] === vehicle);

  const data = {
    'Vehicle number': String(vehicle),
    Driver: String(driver || existing?.data?.Driver || 'Assigned Driver'),
    Route: String(route || existing?.data?.Route || 'Assigned Route'),
    Latitude: String(latitude || 12.9716),
    Longitude: String(longitude || 77.5946),
    'Speed (km/h)': String(speed ?? 30),
    'Trip status': String(tripStatus || 'On route'),
    'Current location': `${latitude || 12.9716}, ${longitude || 77.5946}`,
    'Next stop': String(nextStop || 'Main Campus'),
    ETA: String(eta || '15 mins'),
    'Student count': String(studentCount || 15)
  };

  if (existing) {
    existing.data = { ...existing.data, ...data };
    existing.deviated = Boolean(deviated);
    if (deviated) existing.deviationAlert = `ALERT: Vehicle deviated from ${data.Route}`;
    existing.updatedAt = new Date().toISOString();
  } else {
    records.push({
      id: crypto.randomUUID(),
      data,
      deviated: Boolean(deviated),
      deviationAlert: deviated ? `ALERT: Vehicle deviated from ${data.Route}` : undefined,
      created: new Date().toLocaleDateString('en-IN'),
      updatedAt: new Date().toISOString()
    });
  }

  store.records['Live tracking'] = records;
  await writeStore(store, req);
  res.status(202).json({ message: 'Telemetry updated.' });
});

app.get('/records/:module', requireSession, requireModule, async (req, res) => {
  const module = req.params.module;
  try {
    await ensureMongoConnection();
    const records = await getModuleRecords(module, recordInstitute(req));
    res.json(records);
  } catch (err) {
    console.error(`Error fetching ${module} records:`, err.message);
    res.status(503).json({ message: 'Records database is temporarily unavailable. Please try again.' });
  }
});

app.post('/records/:module', requireSession, requireModule, async (req, res) => {
  const module = req.params.module;
  const data = req.body?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ message: 'Valid data is required.' });

  const record = {
    id: crypto.randomUUID(),
    module,
    instituteName: recordInstitute(req),
    data,
    created: new Date().toLocaleDateString('en-IN'),
    updatedAt: new Date().toISOString()
  };

  try {
    await ensureMongoConnection();
    record.coreLink = await linkRecord(module, data, record.instituteName);
    const saved = await Record.create(record);
    res.status(201).json(saved.toObject());
  } catch (err) {
    console.error(`Error saving ${module} record:`, err.message);
    res.status(503).json({ message: 'Record could not be saved. Please try again.' });
  }
});

// App-linked records must be changed through the transactional enrollment path.
app.use('/records/:module/:id', requireSession, async (req, res, next) => {
  if (!['PUT', 'DELETE'].includes(req.method)) return next();
  try {
    const row = await Record.findOne({ id: req.params.id, module: req.params.module, instituteName: req.user.instituteName }).select('coreLink').lean();
    const Model = { Driver: DriverAccount, Parent: ParentAccount, Child: ChildAccount }[row?.coreLink?.model];
    if (Model && await Model.exists({ _id: row.coreLink.id, accountSource: 'institute' })) return res.status(409).json({ message: req.method === 'DELETE' ? 'This record is an active app account. Contact ASAN Admin to deactivate it; deleting only the Institute card would leave the account active.' : 'Update this app account through App enrollment so the panel and apps stay synchronized.' });
    next();
  } catch { res.status(503).json({ message: 'Unable to verify the linked account. Please retry.' }); }
});

app.put('/records/:module/:id', requireSession, requireModule, async (req, res) => {
  const { module, id } = req.params;
  const updatedData = req.body?.data;
  if (!updatedData || typeof updatedData !== 'object' || Array.isArray(updatedData)) return res.status(400).json({ message: 'Data is required.' });

  try {
    await ensureMongoConnection();
    const record = await Record.findOneAndUpdate(
      { id, module, instituteName: recordInstitute(req) },
      { $set: { data: updatedData, coreLink: await linkRecord(module, updatedData, recordInstitute(req)) } },
      { new: true }
    ).lean();
    if (!record) return res.status(404).json({ message: 'Record not found.' });
    res.json(record);
  } catch (err) {
    console.error(`Error updating ${module} record:`, err.message);
    res.status(503).json({ message: 'Record could not be updated. Please try again.' });
  }
});

app.delete('/records/:module/:id', requireSession, requireModule, async (req, res) => {
  const { module, id } = req.params;
  try {
    await ensureMongoConnection();
    const result = await Record.deleteOne({ id, module, instituteName: recordInstitute(req) });
    if (!result.deletedCount) return res.status(404).json({ message: 'Record not found.' });
    res.status(204).end();
  } catch (err) {
    console.error(`Error deleting ${module} record:`, err.message);
    res.status(503).json({ message: 'Record could not be deleted. Please try again.' });
  }
});

// Student Assignment Endpoint: Student → Pickup Point → Route → Vehicle → Driver
app.post('/students/assign', requireSession, async (req, res) => {
  const { studentId, pickupPoint, pickupCoordinates, routeName, vehicleNumber, driverName } = req.body || {};
  if (!studentId || !routeName) return res.status(400).json({ message: 'Student and Route are required.' });

  try {
    if (await assignEnrolledStudent(req.user, req.body || {})) return res.json({ message: 'Institute student and app assignment updated.' });
  } catch (error) { return res.status(error.status || 500).json({ message: error.status ? error.message : 'Assignment could not be saved.' }); }

  const store = await readStore(req);
  const students = store.records.Students || [];
  const student = students.find(s => s.id === studentId || s.data?.['Student ID'] === studentId);
  if (!student) return res.status(404).json({ message: 'Student not found.' });

  if (pickupCoordinates && !validCampusLocation({ ...pickupCoordinates, address: pickupPoint })) return res.status(400).json({ message: 'Select a valid pickup point on the map.' });
  student.data['Pickup point'] = pickupPoint || student.data['Pickup point'];
  if (pickupCoordinates) student.data['Pickup point coordinates'] = pickupCoordinates;
  student.data['Assigned route'] = routeName;
  student.data['Assigned vehicle'] = vehicleNumber || student.data['Assigned vehicle'];
  student.data['Transportation status'] = 'Active';

  // Also update parent record if linked
  const parents = store.records.Parents || [];
  const parent = parents.find(p => p.data?.Student?.includes(student.data?.['Student name']));
  if (parent) {
    parent.data.Route = routeName;
    parent.data['Pickup point'] = pickupPoint || parent.data['Pickup point'];
    if (pickupCoordinates) parent.data['Pickup point coordinates'] = pickupCoordinates;
  }

  return res.status(409).json({ message: 'Enroll this student through App enrollment before assigning a route and monthly fee.' });
});

// Route Stop Management
app.post('/routes/:id/stops', requireSession, async (req, res) => {
  const { id } = req.params;
  const { stops } = req.body || {};
  if (!Array.isArray(stops)) return res.status(400).json({ message: 'Stops array is required.' });

  const store = await readStore(req);
  const routes = store.records.Routes || [];
  const route = routes.find(r => r.id === id);
  if (!route) return res.status(404).json({ message: 'Route not found.' });

  route.stops = stops;
  await writeStore(store, req);
  res.json({ message: 'Route stops updated successfully.', route });
});

// Online Payment Simulation: Parent → Payment Gateway → ASAN RIDES → Institute Account
app.post('/payments/pay', requireSession, async (_req, res) => {
  return res.status(409).json({ message: 'Simulated payments are disabled. Use the existing ASAN payment checkout; no payment has been recorded.' });
});
// Payment Reminder
app.post('/payments/remind', requireSession, async (req, res) => {
  const { studentName, parentPhone, amount, channels } = req.body || {};
  const store = await readStore(req);
  const notif = {
    id: crypto.randomUUID(),
    data: {
      'Notification title': `Payment Reminder for ${studentName}`,
      Category: 'Payment alerts',
      Audience: `${studentName} Parent (${parentPhone || 'Mobile'})`,
      Channel: (channels || ['WhatsApp', 'SMS']).join(', '),
      Message: `Transport fee of ₹${amount || '2,500'} for September is pending. Please complete payment before the due date.`,
      'Scheduled for': new Date().toISOString(),
      Delivery: 'Recorded only — no message sent'
    },
    created: new Date().toLocaleDateString('en-IN')
  };
  store.records.Notifications = [notif, ...(store.records.Notifications || [])];
  await writeStore(store, req);
  res.json({ message: 'Reminder saved. External messaging is not configured for this Institute portal.', notification: notif.data });
});

// Emergency Trigger
app.post('/emergency', requireSession, async (req, res) => {
  const { type, vehicle, driver, route, location, studentsOnboard, contact, notes } = req.body || {};
  const store = await readStore(req);
  const emgRecord = {
    id: crypto.randomUUID(),
    data: {
      'Emergency type': type || 'Security concern',
      Vehicle: vehicle || 'ASAN-101',
      Driver: driver || 'On-duty driver',
      Route: route || 'Active route',
      'Current location': location || 'City road',
      'Students onboard': String(studentsOnboard || 0),
      'Emergency contact': contact || '+91 98765 00099',
      Status: 'Responding',
      Notes: notes || 'Emergency SOS button triggered from panel.'
    },
    created: new Date().toLocaleDateString('en-IN')
  };
  store.records.Emergency = [emgRecord, ...(store.records.Emergency || [])];
  await writeStore(store, req);
  res.status(201).json({ message: 'Emergency recorded. Contact emergency services directly if immediate help is required.', emergency: emgRecord.data });
});

app.use((error, _req, res, _next) => {
  console.error('Institute request failed:', error.name);
  res.status(error.status || 500).json({ message: error.status === 409 ? error.message : 'Unable to complete the Institute request. Please try again.' });
});
export default app;
