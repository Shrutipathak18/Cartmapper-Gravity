import { Link } from 'react-router-dom'

export default function ContactPage() {
    return (
        <section className="mx-auto w-full max-w-5xl animate-fade-in space-y-4">
            <div className="rounded-2xl border border-[#E5D8C3] bg-white/90 p-5 shadow-sm">
                <h1 className="text-2xl font-extrabold text-[#2f4d1a]">Contact</h1>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#EADFCF] bg-[#FFF9EF] p-3 text-sm font-semibold text-[#5b4d3a]">Shruti pathak - 2230121</div>
                    <div className="rounded-xl border border-[#EADFCF] bg-[#FFF9EF] p-3 text-sm font-semibold text-[#5b4d3a]">Manaswee Dutta - 2230090</div>
                    <div className="rounded-xl border border-[#EADFCF] bg-[#FFF9EF] p-3 text-sm font-semibold text-[#5b4d3a]">Shreyaa Venkateswaran- 2230121</div>
                    <div className="rounded-xl border border-[#EADFCF] bg-[#FFF9EF] p-3 text-sm font-semibold text-[#5b4d3a]">Sumeet Singh- 2230131</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                        to="/"
                        className="rounded-xl border border-[#DCC9A9] bg-[#FFF6E7] px-3 py-1.5 text-sm font-semibold text-[#5a4b36] hover:bg-[#ffefd3]"
                    >
                        Back to Home
                    </Link>
                    <Link
                        to="/about"
                        className="rounded-xl border border-[#DCC9A9] bg-[#FFF6E7] px-3 py-1.5 text-sm font-semibold text-[#5a4b36] hover:bg-[#ffefd3]"
                    >
                        Open About
                    </Link>
                </div>
            </div>
        </section>
    )
}
