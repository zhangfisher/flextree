import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
async function main() {
	const alice = await prisma.fs.upsert({
		where: { email: 'alice@prisma.io' },
		update: {},
		create: {
			email: 'alice@prisma.io',
			name: 'Alice',
			posts: {
				create: {
					title: 'Check out Prisma with Next.js',
					content: 'https://www.prisma.io/nextjs',
					published: true,
				},
			},
		},
	})
}

main()
	.then(async () => {
		await prisma.$disconnect()
	})
	.catch(async (e) => {
		console.error(e)
		await prisma.$disconnect()
		process.exit(1)
	})
