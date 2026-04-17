import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";

export const metadata = { title: "Contact — RestaurantOS" };

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="bg-slate-50 px-5 pb-20 pt-32">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-extrabold text-slate-900">Get in touch</h1>
          <p className="mt-4 text-base text-slate-500">
            Have questions? We&apos;d love to hear from you.
          </p>

          <div className="mt-12 space-y-6 text-left">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">📧 Email</h2>
              <p className="mt-2 text-sm text-slate-500">
                Send us an email and we&apos;ll get back to you within 24 hours.
              </p>
              <a
                href="mailto:hello@restaurantos.com"
                className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:underline"
              >
                hello@restaurantos.com
              </a>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">💬 Live chat</h2>
              <p className="mt-2 text-sm text-slate-500">
                Available Monday to Friday, 9am — 6pm CET.
              </p>
              <p className="mt-3 text-sm text-slate-400">Coming soon</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">📍 Office</h2>
              <p className="mt-2 text-sm text-slate-500">
                Rhodes, Greece
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
