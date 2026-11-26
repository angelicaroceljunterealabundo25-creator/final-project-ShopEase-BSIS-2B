const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,   // snapshot of product name at time of order
    price: Number,  // snapshot of price at time of order
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [orderItemSchema],
      validate: [(v) => v.length > 0, 'Order must have at least one item'],
    },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'ready for pickup', 'completed', 'cancelled'],
      default: 'pending',
    },
    paymentMethod: { type: String, enum: ['cash', 'gcash'], default: 'cash' },
    pickupLocation: { type: String, trim: true, default: 'BUP Polangui Campus' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
