// Legal / data-retention settings. The Privacy Policy states these numbers, so change
// them together with the policy text (frontend/src/lib/legal.ts).

// Bump when the Terms or Privacy Policy change materially: every user is asked to
// accept the new version on their next visit. Must match the frontend's TERMS_VERSION.
const TERMS_VERSION = '2026-10-11';

const DAY_MS = 24 * 60 * 60 * 1000;

module.exports = {
    TERMS_VERSION,
    DAY_MS,
    // A deleted account can be restored for this long, then everything is erased.
    DELETION_GRACE_DAYS: 30,
    // Accounts unused for this long are erased...
    INACTIVITY_DAYS: 730,
    // ...after a notice this many days before, and a reminder this many days before.
    INACTIVITY_NOTICE_DAYS: 30,
    INACTIVITY_REMINDER_DAYS: 7,
};
