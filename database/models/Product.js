const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true },
    description: { type: String, trim: true, default: '' },
    price: { type: Number, required: [true, 'Price is required'], min: 0 },
    category: {
      type: String,
      enum: ['Food', 'School Supplies', 'Books', 'Uniforms', 'Gadgets', 'Others'],
      default: 'Others',
    },
    stock: { type: Number, required: true, min: 0, default: 1 },
    imageUrl: { type: String, default: '' },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['available', 'sold out', 'hidden'],
      default: 'available',
    },
  },
  { timestamps: true }
);

// Enables catalog search by name/description
productSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);
