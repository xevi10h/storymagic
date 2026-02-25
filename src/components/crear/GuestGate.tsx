"use client";

interface GuestGateProps {
  onContinueAsGuest: () => void;
  onLogin: () => void;
  onClose: () => void;
  saving: boolean;
}

export default function GuestGate({
  onContinueAsGuest,
  onLogin,
  onClose,
  saving,
}: GuestGateProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-md rounded-2xl border border-create-neutral bg-white p-8 shadow-xl">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-text-muted hover:text-text-main"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        {/* Icon */}
        <div className="mb-5 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-create-primary/10">
            <span className="material-symbols-outlined text-3xl text-create-primary">
              person
            </span>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-center font-display text-2xl font-bold text-secondary">
          Tu cuento está casi listo
        </h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-text-muted">
          Inicia sesión para guardar el cuento en tu biblioteca y acceder
          desde cualquier dispositivo, o continúa como invitado para
          comprarlo directamente.
        </p>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onLogin}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-create-primary px-4 py-3.5 text-sm font-bold text-white transition-all hover:bg-create-primary-hover active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-lg">bookmark</span>
            Iniciar sesión y guardar en mi biblioteca
          </button>
          <button
            type="button"
            onClick={onContinueAsGuest}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-create-neutral px-4 py-3.5 text-sm font-medium text-text-soft transition-all hover:bg-create-neutral active:scale-[0.98] disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-lg">shopping_bag</span>
            {saving ? "Preparando tu cuento..." : "Continuar como invitado"}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-text-muted">
          Como invitado podrás comprar tu libro, pero no se guardará en una biblioteca personal.
        </p>
      </div>
    </div>
  );
}
