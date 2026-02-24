import { Palette, PenTool, Gift } from "lucide-react";

const STEPS = [
  {
    icon: Palette,
    number: "01",
    title: "Elige una aventura",
    description:
      "Explora nuestra colección de historias y escoge la que más brille en los ojos de tu pequeño.",
  },
  {
    icon: PenTool,
    number: "02",
    title: "Personalización artesanal",
    description:
      "Nombre, aspecto, ciudad, intereses... Cada detalle hace que el cuento sea únicamente suyo.",
  },
  {
    icon: Gift,
    number: "03",
    title: "Recibe el tesoro",
    description:
      "Impreso en papel premium con encuadernación tradicional. Un objeto para guardar toda la vida.",
  },
];

export default function HowItWorks() {
  return (
    <section id="manifiesto" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Crear un cuento mágico es así de sencillo
          </h2>
          <p className="mt-4 text-lg text-text-secondary">
            En tres pasos, tu hijo tendrá entre las manos su propia aventura
            ilustrada.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-3 sm:gap-12">
          {STEPS.map((step) => (
            <div key={step.number} className="relative text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cream">
                <step.icon className="h-7 w-7 text-brand" />
              </div>
              <span className="mt-4 block text-xs font-bold tracking-widest text-brand uppercase">
                Paso {step.number}
              </span>
              <h3 className="mt-2 text-xl font-bold text-text-primary">
                {step.title}
              </h3>
              <p className="mt-3 text-text-secondary leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
