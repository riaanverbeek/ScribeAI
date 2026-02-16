import { Check, X } from "lucide-react";
import { PASSWORD_REQUIREMENTS } from "@shared/passwordValidation";

interface PasswordRequirementsProps {
  password: string;
}

export default function PasswordRequirements({ password }: PasswordRequirementsProps) {
  if (!password) return null;

  return (
    <div className="space-y-1 mt-2" data-testid="password-requirements">
      {PASSWORD_REQUIREMENTS.map((req, i) => {
        const met = req.test(password);
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            {met ? (
              <Check className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            <span className={met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
              {req.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
