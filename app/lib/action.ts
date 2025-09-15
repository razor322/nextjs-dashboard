"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import postgres from "postgres";
import { z } from "zod";

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({ invalid_type_error: "Please select a customer." }),
  amount: z
    .number()
    .gt(0, { message: "Please enter an amount greater than $0." }),
  status: z.enum(["pending", "paid"], {
    invalid_type_error: "Please select an invoice status.",
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
  error?: {
    message: string;
  };
};
export async function createInvoice(prevState: State, formdata: FormData) {
  // Validate form fields using Zod
  const validateField = CreateInvoice.safeParse({
    customerId: formdata.get("customerId"),
    amount: Number(formdata.get("amount")),
    status: formdata.get("status"),
  });
  // If form validation fails, return errors early. Otherwise, continue.
  if (!validateField.success) {
    return {
      errors: validateField.error.flatten().fieldErrors,
      message: "Missing Fields. Failed to Create Invoice.",
    };
  }
  // Prepare data for insertion into the database
  const { customerId, amount, status } = validateField.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split("T")[0];
  console.log("Creating invoice with data:", {
    customerId,
    amount,
    status,
  });
  // Insert data into the database
  try {
    console.log("Inserting invoice into database...");
    await sql`INSERT INTO invoices (customer_id, amount, status, date) VALUES (${customerId}, ${amountInCents}, ${status}, ${date})`;
  } catch (error) {
    // If a database error occurs, return a more specific error.
    console.error("Error creating invoice:", error);
    return {
      error: { message: "Database error. Failed to create invoice." },
    };
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}
export async function updateInvoice(
  id: string,
  prevState: State,
  formdata: FormData
): Promise<State> {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formdata.get("customerId"),
    amount: Number(formdata.get("amount")),
    status: formdata.get("status"),
  });
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing Fields. Failed to Update Invoice.",
    };
  }
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  console.log("Updating invoice with data:", {
    id,
    customerId,
    amount,
    status,
  });
  try {
    console.log("Updating invoice in database...");
    await sql`UPDATE invoices SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status} WHERE id = ${id}`;
  } catch (error) {
    console.error("Error updating invoice:", error);
    return { message: "Database Error: Failed to Update Invoice." };
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}
export async function deleteInvoice(id: string) {
  await sql`DELETE FROM invoices WHERE id = ${id}`;
  revalidatePath("/dashboard/invoices");
}
export async function authenticate(
  prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  try {
    await signIn("credentials", formData);
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid email or password.";
        default:
          return "Something went wrong. Please try again.";
      }
    }
    throw error;
  }
}
