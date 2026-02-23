const mongoose = require('mongoose');

const customerInterestSchema = new mongoose.Schema({
    location: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        required: true
    },
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['interested', 'not_interested'],
        required: true
    },
    // Customer details (only for interested)
    monthly_electric_bill: {
        type: Number,
        min: 0
    },
    electricity_usage: {
        type: String,
        enum: ['day', 'night', 'both', null]
    },
    customer_phone: {
        type: String,
        trim: true
    },
    customer_name: {
        type: String,
        trim: true
    },
    notes: {
        type: String,
        trim: true
    },
    // Approval
    is_approved: {
        type: Boolean,
        default: false
    },
    approved_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approved_at: Date
}, {
    timestamps: true
});

// Index for queries
customerInterestSchema.index({ employee: 1, status: 1 });
customerInterestSchema.index({ location: 1, employee: 1 }, { unique: true });
customerInterestSchema.index({ is_approved: 1, status: 1 });

module.exports = mongoose.model('CustomerInterest', customerInterestSchema);
