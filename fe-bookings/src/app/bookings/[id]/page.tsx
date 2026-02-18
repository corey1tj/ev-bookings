import { getBookingRequest } from "@/lib/ampeco";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

export default async function BookingDetailPage({ params }: Props) {
  const id = parseInt(params.id);
  if (isNaN(id)) notFound();

  let bookingRequest;
  try {
    const res = await getBookingRequest(id);
    bookingRequest = res.data;
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 text-center">
          <div className="mb-2 text-3xl">✅</div>
          <h1 className="text-xl font-bold">Booking Confirmed</h1>
          <p className="mt-1 text-sm text-gray-500">
            Booking reference: #{bookingRequest.id}
          </p>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex justify-between border-b pb-2">
            <dt className="text-gray-500">Status</dt>
            <dd className="font-medium capitalize">{bookingRequest.status}</dd>
          </div>
        </dl>

        <div className="mt-6 text-center">
          <a
            href="/sites"
            className="text-sm text-blue-600 hover:underline"
          >
            Book another session
          </a>
        </div>
      </div>
    </div>
  );
}
