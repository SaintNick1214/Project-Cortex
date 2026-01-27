import { notFound } from "next/navigation";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
import { BotIcon, GlobeIcon, UserIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const chat = await getChatById({ id });

  // Access check: only show public conversations
  if (!chat || chat.visibility !== "public") {
    notFound();
  }

  const messages = await getMessagesByChatId({ id });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <GlobeIcon size={16} />
          <span className="text-muted-foreground text-sm">Shared Chat</span>
          <span className="mx-2 text-muted-foreground">·</span>
          <h1 className="truncate font-medium">{chat.title}</h1>
        </div>
      </header>

      {/* Messages */}
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <div className="space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">
                This conversation is empty.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                className="group flex gap-4 rounded-lg p-4 transition-colors hover:bg-muted/50"
                key={message.id}
              >
                {/* Avatar */}
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.role === "user" ? (
                    <UserIcon />
                  ) : (
                    <BotIcon />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 space-y-2">
                  <div className="font-semibold capitalize">{message.role}</div>
                  <div className="prose prose-neutral dark:prose-invert max-w-none text-sm leading-relaxed">
                    <MessageContent parts={message.parts} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t pt-6 text-center text-muted-foreground text-sm">
          <p>
            Shared on{" "}
            {new Date(chat.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </footer>
      </main>
    </div>
  );
}

function MessageContent({ parts }: { parts: unknown }) {
  // Handle different part types
  if (typeof parts === "string") {
    return <p className="whitespace-pre-wrap">{parts}</p>;
  }

  if (Array.isArray(parts)) {
    return (
      <>
        {parts.map((part, index) => {
          if (typeof part === "object" && part !== null && "type" in part) {
            const typedPart = part as { type: string; text?: string };
            if (typedPart.type === "text" && typedPart.text) {
              return (
                <p className="whitespace-pre-wrap" key={index}>
                  {typedPart.text}
                </p>
              );
            }
          }
          // Fallback for unknown part types
          if (typeof part === "string") {
            return (
              <p className="whitespace-pre-wrap" key={index}>
                {part}
              </p>
            );
          }
          return null;
        })}
      </>
    );
  }

  // Fallback for unknown content
  return <p className="text-muted-foreground italic">Unable to display content</p>;
}
