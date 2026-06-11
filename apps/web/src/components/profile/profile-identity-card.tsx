import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  CircleCheck,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

type CandidateLink = { key: string; label: string; href: string };

type Completeness = { filled: number; total: number; missing: string[] };

type ProfileIdentityCardProps = {
  name: string;
  email: string | null;
  phone: string | null;
  currentRole: string | null;
  targetRole: string | null;
  yearsOfExperience: number | null;
  location: string | null;
  links: CandidateLink[];
  completeness: Completeness;
};

export function ProfileIdentityCard({
  name,
  email,
  phone,
  currentRole,
  targetRole,
  yearsOfExperience,
  location,
  links,
  completeness,
}: ProfileIdentityCardProps) {
  const meta = [
    email ? { key: "email", icon: Mail, text: email } : null,
    phone ? { key: "phone", icon: Phone, text: phone } : null,
    location ? { key: "location", icon: MapPin, text: location } : null,
    typeof yearsOfExperience === "number"
      ? {
          key: "years",
          icon: Briefcase,
          text: `${yearsOfExperience} year${yearsOfExperience === 1 ? "" : "s"} experience`,
        }
      : null,
  ].filter(Boolean) as { key: string; icon: typeof Mail; text: string }[];

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-col gap-2.5">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">{name}</h2>
            {currentRole || targetRole ? (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
                {currentRole ? <span>{currentRole}</span> : null}
                {currentRole && targetRole ? (
                  <ArrowRight aria-hidden className="size-3.5" />
                ) : null}
                {targetRole ? (
                  <span className="font-medium text-foreground">{targetRole}</span>
                ) : null}
              </p>
            ) : null}
          </div>
          {meta.length ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {meta.map(({ key, icon: Icon, text }) => (
                <span key={key} className="flex items-center gap-1.5">
                  <Icon aria-hidden className="size-3.5" />
                  {text}
                </span>
              ))}
            </div>
          ) : null}
          {links.length ? (
            <div className="flex flex-wrap gap-2">
              {links.map((link) => (
                <a
                  key={link.key}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {link.label}
                  <ArrowUpRight data-icon="inline-end" />
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 md:max-w-56 md:items-end md:text-right">
          {completeness.missing.length === 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CircleCheck aria-hidden className="size-4 text-brand" />
              All targeting fields set
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {completeness.filled} of {completeness.total} targeting fields set
              </p>
              <div className="flex flex-wrap gap-1.5 md:justify-end">
                {completeness.missing.map((label) => (
                  <Badge key={label} variant="outline">
                    {label}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
