const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        trim: true
    },
    province: {
        code: String,
        name_th: String,
        name_en: String
    },
    district: {
        code: String,
        name_th: String,
        name_en: String
    },
    subdistrict: {
        code: String,
        name_th: String,
        name_en: String
    },
    postal_code: String,
    location_type: {
        type: String,
        enum: ['บ้านพักอาศัย', 'อาคารพาณิชย์', 'โรงงาน', 'ห้างสรรพสินค้า', 'โรงแรม', 'โรงเรียน', 'โรงพยาบาล', 'อื่นๆ'],
        default: 'บ้านพักอาศัย'
    },
    coordinates: {
        lat: Number,
        lng: Number
    },
    google_place_id: String,
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Index for search
locationSchema.index({ 'province.name_th': 1, 'district.name_th': 1 });
locationSchema.index({ name: 'text', address: 'text' });

module.exports = mongoose.model('Location', locationSchema);
