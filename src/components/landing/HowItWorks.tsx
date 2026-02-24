import { Palette, PenTool, Gift } from "lucide-react";

const STEPS = [
  {
    icon: Palette,
    number: "1",
    title: "Elige una aventura",
    description:
      "Explora nuestra colección de historias y escoge la que más brille en los ojos de tu pequeño.",
    bgColor: "bg-[#FAF3E0]",
  },
  {
    icon: PenTool,
    number: "2",
    title: "Personalización artesanal",
    description:
      "Nombre, aspecto, ciudad, intereses... Cada detalle hace que el cuento sea únicamente suyo.",
    bgColor: "bg-[#EBE0D6]",
  },
  {
    icon: Gift,
    number: "3",
    title: "Recibe el tesoro",
    description:
      "Impreso en papel premium con encuadernación tradicional. Un objeto para guardar toda la vida.",
    bgColor: "bg-[#E0E9D8]",
  },
];

export default function HowItWorks() {
  return (
    <section id="manifiesto" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-widest text-primary">
            Así de fácil
          </span>
          <h2 className="mt-3 font-display text-4xl font-bold text-text-main">
            Crear un cuento mágico es así de sencillo
          </h2>
          <p className="mt-4 text-lg text-text-soft">
            En tres pasos, tu hijo tendrá entre las manos su propia aventura
            ilustrada.
          </p>
        </div>

        <div className="relative mt-20">
          {/* Dotted connector line */}
          <div className="absolute top-12 right-[16.67%] left-[16.67%] hidden border-t-2 border-dashed border-stone-300 sm:block" />

          <div className="grid gap-12 sm:grid-cols-3 sm:gap-8">
            {STEPS.map((step) => (
              <div key={step.number} className="relative text-center">
                <div
                  className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full ${step.bgColor} border-4 border-white shadow-md`}
                >
                  <step.icon className="h-8 w-8 text-secondary" />
                </div>
                <span className="mt-5 block font-display text-sm font-bold text-primary">
                  Paso {step.number}
                </span>
                <h3 className="mt-2 font-display text-xl font-bold text-text-main">
                  {step.title}
                </h3>
                <p className="mx-auto mt-3 max-w-xs text-text-soft leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
