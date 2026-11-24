
// Creates sample users and products so the app can be tested right away.
// Run:  npm run seed
require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Product = require('./models/Product');

const users = [
    { name: 'ShopEase Admin', email: 'admin@shopease.com', password: 'admin123', role: 'admin' },
    { name: 'ShopEase Staff', email: 'staff@shopease.com', password: 'staff123', role: 'staff' },
    { name: 'Juan Dela Cruz', email: 'juan@example.com', password: 'juan123', role: 'customer' }
];

const products = [
    { name: 'Notebook', description: 'A simple and useful notebook for students, teachers, and everyday school activities.', price: 50, category: 'School Supplies', stock: 100 },
    { name: 'Pencil Set', description: 'A set of pencils for writing, drawing, and school work.', price: 35, category: 'School Supplies', stock: 80 },
    { name: 'School Bag', description: 'A sturdy bag for books, notebooks, and daily school needs.', price: 350, category: 'School Essentials', stock: 5 },
    { name: 'Geometry Set', description: 'Ruler, protractor, and compass for math class.', price: 85, category: 'Study Supplies', stock: 40 },
    { name: 'Coloring Set', description: 'Colored pencils and crayons for projects and art class.', price: 65, category: 'Study Supplies', stock: 60 },
    { name: 'Folder', description: 'A plastic folder to keep papers organized.', price: 25, category: 'School Supplies', stock: 120 }
];

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        for (const u of users) {
            const exists = await User.findOne({ email: u.email });
            if (!exists) {
                await User.create({ ...u, password: await bcrypt.hash(u.password, 10) });
                console.log('Created user', u.email);
            }
        }

        for (const p of products) {
            const exists = await Product.findOne({ name: p.name });
            if (!exists) {
                await Product.create(p);
                console.log('Created product', p.name);
            }
        }

        console.log('Seed finished');
    } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
})();