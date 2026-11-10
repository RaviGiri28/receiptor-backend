const {EntitySchema}= require('typeorm');
const User = new EntitySchema({
    name:'User',
    tableName:'users',

    columns:{
        id:{
            primary:true,
            type:'int',
            generated:true,
        },
        name:{
            type:'varchar',
            length:100,
            nullable:false,
        },
        email:{
            type:'varchar',
            length:100,
            unique:true,
            nullable:false,
        },
        password:{
            type:'varchar',
            length:255,
            nullable:false,
        },
        phone_number:{
            type:'varchar',
            length:20,
            nullable:false,
        },
        business_name:{
            type:'varchar',
            length:150,
            nullable:false,
        },
        business_address:{
            type:'text',
            nullable:false,
        },
        business_phone:{
            type:'varchar',
            length:20,
            nullable:true,
        },
        business_logo:{
            type:'varchar',
            length:255,
            nullable:true,
        },
        // Cloudinary public_id, used to delete the image when the logo is replaced.
        business_logo_public_id:{
            type:'varchar',
            length:255,
            nullable:true,
        },
        // Extra receipt fields defined in Settings: [{ id, label }]. Receipts store
        // their values keyed by id, so the definitions must be shared by all devices.
        // NULL = never saved (the client then uploads any definitions it kept locally).
        custom_field_defs:{
            type:'json',
            nullable:true,
        },
        // bcrypt hash of the 4-digit app passcode (Settings), asked when the app is opened
        // and before deleting a receipt. NULL = no passcode.
        app_passcode:{
            type:'varchar',
            length:255,
            nullable:true,
            default:null,
        },
        // Tokens issued before this moment are rejected (see authMiddleware).
        password_changed_at:{
            type:'timestamp',
            nullable:true,
            default:null,
        },
        // Single-device login: the id of the one session allowed to use the account (the
        // "sid" claim of its token). A new login replaces it, which signs out the previous
        // device (see authMiddleware). NULL = no login since this was introduced.
        session_id:{
            type:'varchar',
            length:36,
            nullable:true,
            default:null,
        },
        // When and on what device the current session was started, shown to the device
        // that gets signed out.
        session_started_at:{
            type:'timestamp',
            nullable:true,
            default:null,
        },
        session_device:{
            type:'varchar',
            length:100,
            nullable:true,
            default:null,
        },
        // Forgot password: SHA-256 of the emailed one-time token, and when it stops working.
        password_reset_token_hash:{
            type:'varchar',
            length:64,
            nullable:true,
            default:null,
        },
        password_reset_expires_at:{
            type:'timestamp',
            nullable:true,
            default:null,
        },
        // "Mark all as read": notifications published before this are read.
        notifications_cleared_at:{
            type:'timestamp',
            nullable:true,
            default:null,
        },
        // Terms & Privacy Policy version the user accepted, and when (see config/legal.js).
        terms_version:{
            type:'varchar',
            length:20,
            nullable:true,
            default:null,
        },
        terms_accepted_at:{
            type:'timestamp',
            nullable:true,
            default:null,
        },
        // Set when the user deletes their account; the account can be restored until
        // DELETION_GRACE_DAYS later, when everything is erased (services/retention.js).
        deletion_requested_at:{
            type:'timestamp',
            nullable:true,
            default:null,
        },
        // Last login / app use (updated at most once a day), for the inactivity rule.
        last_active_at:{
            type:'timestamp',
            nullable:true,
            default:null,
        },
        // Inactivity emails already sent; cleared when the user comes back.
        inactivity_notice_at:{
            type:'timestamp',
            nullable:true,
            default:null,
        },
        inactivity_reminder_at:{
            type:'timestamp',
            nullable:true,
            default:null,
        },
        // Set by an admin to deactivate (ban) the account: the user can still log in,
        // view and download past receipts, but cannot create or edit receipts.
        // NULL = active.
        deactivated_at:{
            type:'timestamp',
            nullable:true,
            default:null,
        },
        // When an admin last reactivated the account (drives the "reactivated" notification).
        reactivated_at:{
            type:'timestamp',
            nullable:true,
            default:null,
        },
        // Subscription (services/subscription.js): 'trial' or 'paid'. NULL = never had
        // a plan (accounts made before subscriptions, until they use a coupon).
        plan:{
            type:'varchar',
            length:10,
            nullable:true,
            default:null,
        },
        // Paid plan id from config/plans.js (monthly / quarterly / yearly).
        plan_id:{
            type:'varchar',
            length:20,
            nullable:true,
            default:null,
        },
        plan_started_at:{
            type:'timestamp',
            nullable:true,
            default:null,
        },
        // Receipts can be created until this moment.
        plan_expires_at:{
            type:'timestamp',
            nullable:true,
            default:null,
        },
        // Trial chosen at signup; it starts (plan_expires_at is set) on the first login.
        trial_days_pending:{
            type:'int',
            nullable:true,
            default:null,
        },
        // plan_expires_at the "ends in 24 hours" email was sent for (so each period gets one).
        expiry_reminder_for:{
            type:'timestamp',
            nullable:true,
            default:null,
        },
        created_at:{
            type:'timestamp',
            createDate:true,
        }
    }
});

module.exports= User;