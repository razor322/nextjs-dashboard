import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import postgres from "postgres";
import bcrypt from "bcrypt";
const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });
async function getUser(email: string) {
  try {
    const user = await sql`SELECT * FROM users WHERE email= ${email}`;
    return user[0];
  } catch (error) {
    console.error("Error fetching user:", error);
    throw new Error("Database Error: Unable to fetch user.");
  }
}

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({
            email: z.string().email({ message: "Please enter a valid email." }),
            password: z.string().min(6, {
              message: "Password must be at least 6 characters long.",
            }),
          })
          .safeParse(credentials);
        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          const user = await getUser(email);
          if (!user) return null;
          const passwordMatch = await bcrypt.compare(password, user.password);
          if (!passwordMatch) return null;
          return {
            id: user.id,
            name: user.name,
            email: user.email,
          };
        }
        console.log("Invalid credentials");
        return null;
      },
    }),
  ],
});
