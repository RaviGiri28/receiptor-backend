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
        created_at:{
            type:'timestamp',
            createDate:true,
        }
    }
});

module.exports= User;