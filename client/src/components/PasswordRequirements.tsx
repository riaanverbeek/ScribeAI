import { Check, X } from "lucide-react";
import { PASSWORD_REQUIREMENTS } from "@shared/passwordValidation";

interface PasswordRequirementsProps {
  password: string;
}

export default function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const hasInput = password.length > 0;

  return (
    <div className="space-y-1 mt-2" data-testid="password-requirements">
      {PASSWORD_REQUIREMENTS.map((req, i) => {
        const met = hasInput && req.test(password);
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            {hasInput ? (
              met ? (
                <Check className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />
              ) : (
                <X className="h-3 w-3 text-destructive shrink-0" />
              )
            ) : (
              <div className="h-3 w-3 rounded-full border border-muted-foreground/40 shrink-0" />
            )}
            <span className={hasInput ? (met ? "text-green-600 dark:text-green-400" : "text-destructive") : "text-muted-foreground"}>
              {req.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
