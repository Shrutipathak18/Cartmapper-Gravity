import { Link } from 'react-router-dom'

export default function AboutPage() {
    return (
        <section className="mx-auto w-full max-w-5xl animate-fade-in space-y-4">
            <div className="rounded-2xl border border-[#E5D8C3] bg-white/90 p-5 shadow-sm">
                <h1 className="text-2xl font-extrabold text-[#2f4d1a]">About CartMapper</h1>
                <p className="mt-3 text-sm leading-7 text-[#4c5f2d]">
                    CartMapper is a smart grocery assistant that helps users upload shopping lists, scan store QR, discover offers,
                    and find exact indoor aisle locations using map guidance. It is designed to make store visits faster, easier,
                    and more organized for every shopper.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                        to="/"
                        className="rounded-xl border border-[#DCC9A9] bg-[#FFF6E7] px-3 py-1.5 text-sm font-semibold text-[#5a4b36] hover:bg-[#ffefd3]"
                    >
                        Back to Home
                    </Link>
                    <Link
                        to="/contact"
                        className="rounded-xl border border-[#DCC9A9] bg-[#FFF6E7] px-3 py-1.5 text-sm font-semibold text-[#5a4b36] hover:bg-[#ffefd3]"
                    >
                        Open Contact
                    </Link>
                </div>
            </div>
        </section>
    )
}
