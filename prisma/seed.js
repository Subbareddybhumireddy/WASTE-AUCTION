const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Clean existing records (optional, in order of dependencies)
  await prisma.review.deleteMany();
  await prisma.report.deleteMany();
  await prisma.order.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.listingImage.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.scrapRate.deleteMany();
  await prisma.category.deleteMany();
  await prisma.otpVerification.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('Password123!', 10);
  const hashedAdminPassword = await bcrypt.hash('Admin123!', 10);

  // 2. Seed Users
  const seller = await prisma.user.create({
    data: {
      name: 'Eco Scrap Recycler (David)',
      email: 'seller@waste2worth.com',
      phone: '+19876543210',
      passwordHash: hashedPassword,
      role: 'SELLER',
      isPhoneVerified: true,
      isEmailVerified: true,
      city: 'Industrial Area, West Sector',
      address: 'Plot 42, Green Yard Depot',
      pincode: '110001',
    },
  });

  const buyer = await prisma.user.create({
    data: {
      name: 'Apex Metal & Paper Mill (Sarah)',
      email: 'buyer@waste2worth.com',
      phone: '+11234567890',
      passwordHash: hashedPassword,
      role: 'BUYER',
      isPhoneVerified: true,
      isEmailVerified: true,
      city: 'Metropolis Hub',
      address: '77 Circular Road, Phase 2',
      pincode: '110022',
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: 'System Administrator',
      email: 'admin@waste2worth.com',
      phone: '+15550001111',
      passwordHash: hashedAdminPassword,
      role: 'ADMIN',
      isPhoneVerified: true,
      isEmailVerified: true,
      city: 'Central Operations',
      address: 'Headquarters Tower 1',
      pincode: '110001',
    },
  });

  console.log(`✅ Seeded users:
  - Seller: ${seller.email} / ${seller.phone} (Password: Password123!)
  - Buyer:  ${buyer.email} / ${buyer.phone} (Password: Password123!)
  - Admin:  ${admin.email} / ${admin.phone} (Password: Admin123!)`);

  // 3. Seed Categories
  const categoriesData = [
    {
      name: 'Metals & Alloys',
      slug: 'metals-alloys',
      description: 'Copper wire, aluminium sheets, iron scrap, brass, steel alloys',
      icon: 'Hammer',
    },
    {
      name: 'Paper & Cardboard',
      slug: 'paper-cardboard',
      description: 'Corrugated cartons, packaging boxes, newspapers, white office paper',
      icon: 'FileText',
    },
    {
      name: 'Plastics & Polymers',
      slug: 'plastics-polymers',
      description: 'PET water bottles, HDPE drums, PP plastics, LDPE films',
      icon: 'Recycle',
    },
    {
      name: 'E-Waste & Electronics',
      slug: 'e-waste',
      description: 'Printed circuit boards, obsolete motherboards, computers, wire cables',
      icon: 'Cpu',
    },
    {
      name: 'Batteries & Lead',
      slug: 'batteries',
      description: 'Automobile lead-acid batteries, industrial UPS backup batteries',
      icon: 'BatteryCharging',
    },
    {
      name: 'Glass & Bottles',
      slug: 'glass',
      description: 'Cullet glass, intact beverage bottles, container glass',
      icon: 'Wine',
    },
  ];

  const categoryMap = {};
  for (const cat of categoriesData) {
    const createdCat = await prisma.category.create({ data: cat });
    categoryMap[cat.slug] = createdCat;
  }
  console.log('✅ Seeded 6 categories');

  // 4. Seed Scrap Rates
  const scrapRates = [
    {
      categoryId: categoryMap['metals-alloys'].id,
      itemName: 'Copper Wire (Bright Clean)',
      unit: 'kg',
      minRate: 680,
      maxRate: 740,
      currentRate: 715,
      priceChange: 2.4,
    },
    {
      categoryId: categoryMap['metals-alloys'].id,
      itemName: 'Aluminium Extrusion Scrap',
      unit: 'kg',
      minRate: 145,
      maxRate: 165,
      currentRate: 158,
      priceChange: -0.8,
    },
    {
      categoryId: categoryMap['metals-alloys'].id,
      itemName: 'Heavy Melting Steel (HMS 1&2)',
      unit: 'kg',
      minRate: 36,
      maxRate: 42,
      currentRate: 39.5,
      priceChange: 1.2,
    },
    {
      categoryId: categoryMap['metals-alloys'].id,
      itemName: 'Brass Honey / Castings',
      unit: 'kg',
      minRate: 430,
      maxRate: 475,
      currentRate: 460,
      priceChange: 0.5,
    },
    {
      categoryId: categoryMap['paper-cardboard'].id,
      itemName: 'Corrugated Cardboard (OCC)',
      unit: 'kg',
      minRate: 12,
      maxRate: 16,
      currentRate: 14.5,
      priceChange: 3.1,
    },
    {
      categoryId: categoryMap['paper-cardboard'].id,
      itemName: 'Old Newspaper (ONP)',
      unit: 'kg',
      minRate: 14,
      maxRate: 18,
      currentRate: 16,
      priceChange: 0.0,
    },
    {
      categoryId: categoryMap['plastics-polymers'].id,
      itemName: 'PET Bottles (Clean Baled)',
      unit: 'kg',
      minRate: 28,
      maxRate: 35,
      currentRate: 32,
      priceChange: -1.5,
    },
    {
      categoryId: categoryMap['plastics-polymers'].id,
      itemName: 'HDPE Blue Drums / Cans',
      unit: 'kg',
      minRate: 45,
      maxRate: 52,
      currentRate: 49,
      priceChange: 1.8,
    },
    {
      categoryId: categoryMap['e-waste'].id,
      itemName: 'Mixed Computer Motherboards',
      unit: 'kg',
      minRate: 280,
      maxRate: 360,
      currentRate: 325,
      priceChange: 4.2,
    },
    {
      categoryId: categoryMap['batteries'].id,
      itemName: 'Scrap Lead Acid Car Batteries',
      unit: 'kg',
      minRate: 85,
      maxRate: 98,
      currentRate: 92,
      priceChange: 0.9,
    },
  ];

  for (const rate of scrapRates) {
    await prisma.scrapRate.create({ data: rate });
  }
  console.log(`✅ Seeded ${scrapRates.length} scrap market rates`);

  // 5. Seed Sample Listings
  const listing1 = await prisma.listing.create({
    data: {
      sellerId: seller.id,
      categoryId: categoryMap['metals-alloys'].id,
      title: '500 kg High-Grade Stripped Copper Wire',
      description: 'Industrial surplus bright copper scrap wire, 99.9% purity, bundled and ready for immediate factory inspection and pickup.',
      quantity: 500,
      unit: 'kg',
      expectedPrice: 710,
      condition: 'Clean Stripped',
      location: 'Industrial Estate, Sector 12',
      pincode: '110001',
      status: 'ACTIVE',
      images: {
        create: [
          {
            imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
            isPrimary: true,
          },
        ],
      },
    },
  });

  const listing2 = await prisma.listing.create({
    data: {
      sellerId: seller.id,
      categoryId: categoryMap['paper-cardboard'].id,
      title: '2.5 Tons Baled Corrugated Cardboard Boxes',
      description: 'Factory warehouse clean baled carton boxes. Stored in dry indoor shed. Sorted, zero moisture, ready for paper mill dispatch.',
      quantity: 2500,
      unit: 'kg',
      expectedPrice: 14,
      condition: 'Dry Baled',
      location: 'Logistics Hub Yard B',
      pincode: '110001',
      status: 'ACTIVE',
      images: {
        create: [
          {
            imageUrl: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80',
            isPrimary: true,
          },
        ],
      },
    },
  });
  console.log('✅ Seeded sample listings');

  // 6. Seed Sample Bid
  const bid1 = await prisma.bid.create({
    data: {
      listingId: listing1.id,
      buyerId: buyer.id,
      bidAmount: 705,
      note: 'Offering 705/kg with prompt payment and our own logistics transport within 24 hours.',
      status: 'PENDING',
    },
  });
  console.log('✅ Seeded sample bid');

  // 7. Seed Sample Order & Review
  const order1 = await prisma.order.create({
    data: {
      listingId: listing2.id,
      bidId: null,
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 35000,
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      pickupAddress: 'Logistics Hub Yard B, Gate 3',
      notes: 'Picked up on time, verified weight on weighbridge.',
    },
  });

  await prisma.review.create({
    data: {
      orderId: order1.id,
      reviewerId: buyer.id,
      revieweeId: seller.id,
      rating: 5,
      comment: 'Excellent quality clean cardboard and very professional loading team. Highly recommended seller!',
    },
  });
  console.log('✅ Seeded sample order and review');

  console.log('🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

