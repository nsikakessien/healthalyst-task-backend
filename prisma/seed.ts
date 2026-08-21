import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.booking.deleteMany();
  await prisma.appointmentSlot.deleteMany();
  await prisma.user.deleteMany();
  await prisma.clinic.deleteMany();

  const clinicA = await prisma.clinic.create({
    data: {
      name: "Apex Care Health",
      slug: "apex-care",
      address: "12 Medical Drive, Victoria Island, Lagos",
    },
  });

  const clinicB = await prisma.clinic.create({
    data: {
      name: "Metro Dental & Eye Clinic",
      slug: "metro-dental",
      address: "45 Commercial Avenue, Yaba, Lagos",
    },
  });

  const passwordHash = await bcrypt.hash("Password123!", 10);

  await prisma.user.create({
    data: {
      email: "admin@apex.com",
      password: passwordHash,
      name: "Apex Admin",
      role: "ADMIN",
      clinicId: clinicA.id,
    },
  });

  await prisma.user.create({
    data: {
      email: "admin@metro.com",
      password: passwordHash,
      name: "Metro Admin",
      role: "ADMIN",
      clinicId: clinicB.id,
    },
  });

  await prisma.user.create({
    data: {
      email: "patient@demo.com",
      password: passwordHash,
      name: "John Doe",
      role: "PATIENT",
    },
  });

  const now = new Date();
  const generateSlots = (clinicId: string) => {
    return [1, 2, 3, 4, 5].map((i) => ({
      clinicId,
      startTime: new Date(now.getTime() + i * 3600 * 1000),
      endTime: new Date(now.getTime() + (i * 3600 + 1800) * 1000),
      isBooked: i === 1,
    }));
  };

  const generateApexSlots = () => {
    const slots = [];
    const appointmentTimes = [9, 10, 11, 14, 15, 16];

    for (let day = 1; day <= 7; day += 1) {
      for (const hour of appointmentTimes) {
        const startTime = new Date(now);
        startTime.setDate(now.getDate() + day);
        startTime.setHours(hour, 0, 0, 0);

        const endTime = new Date(startTime);
        endTime.setMinutes(30);

        slots.push({
          clinicId: clinicA.id,
          startTime,
          endTime,
          isBooked: false,
        });
      }
    }

    return slots;
  };

  await prisma.appointmentSlot.createMany({
    data: [...generateApexSlots(), ...generateSlots(clinicB.id)],
  });

  console.log("Database seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
