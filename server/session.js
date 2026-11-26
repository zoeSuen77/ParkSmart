'use strict';

// Server-side session ownership. A high-entropy token is stored in an
// HttpOnly cookie; the Sessions collection holds the plate and student_id.
// License plates or reservation IDs from the client never grant authority —
// ownership is always resolved from this server-side session.

const crypto = require('crypto');
const { getDb } = require('./db');

const COOKIE_NAME = 'parksmart_sid';

async function sessionMiddleware(req, res, next) {
  try {
    const db = getDb();
    let token = req.cookies[COOKIE_NAME];
    let sessionDoc = null;

    if (token && /^[a-f0-9]{64}$/.test(token)) {
      sessionDoc = await db.collection('sessions').findOne({ _id: token });
    }

    if (!sessionDoc) {
      token = crypto.randomBytes(32).toString('hex');
      sessionDoc = {
        _id: token,
        plate: null,
        student_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      await db.collection('sessions').insertOne(sessionDoc);
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.secure,
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      });
    }

    req.sessionId = token;
    req.sessionDoc = sessionDoc;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { sessionMiddleware, COOKIE_NAME };
