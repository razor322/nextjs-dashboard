"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import postgres from "postgres";
import { z } from "zod";

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.number(),
  status: z.enum(["pending", "paid"]),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });
export async function createInvoice(formdata: FormData) {
  const { customerId, amount, status } = CreateInvoice.parse({
    customerId: formdata.get("customerId"),
    amount: formdata.get("amount"),
    status: formdata.get("status"),
  });
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split("T")[0];
  console.log("Creating invoice with data:", {
    customerId,
    amount,
    status,
  });
  try {
    await sql`INSERT INTO invoices (customer_id, amount, status, date) VALUES (${customerId}, ${amountInCents}, ${status}, ${date})`;
  } catch (error) {
    console.error("Error creating invoice:", error);
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}
export async function updateInvoice(id: string, formdata: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formdata.get("customerId"),
    amount: formdata.get("amount"),
    status: formdata.get("status"),
  });
  const amountInCents = amount * 100;
  try {
    await sql`UPDATE invoices SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status} WHERE id = ${id}`;
  } catch (error) {
    console.error("Error updating invoice:", error);
  }

  console.log("Updating invoice with data:", {
    id,
    customerId,
    amount,
    status,
  });
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}
export async function deleteInvoice(id: string) {
  await sql`DELETE FROM invoices WHERE id = ${id}`;
  revalidatePath("/dashboard/invoices");
}
