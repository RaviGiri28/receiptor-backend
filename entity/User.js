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
        // Tokens issued before this moment are rejected (see authMiddleware).
        password_changed_at:{
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
        created_at:{
            type:'timestamp',
            createDate:true,
        }
    }
});

module.exports= User;