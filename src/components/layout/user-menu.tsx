import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  User,
  Languages,
  Moon,
  LogOut,
  LogIn,
  UserPlus,
  SlidersHorizontal,
  MessageSquareQuote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { usePremiumAccess } from "@/hooks/use-premium-access";
import { useTheme } from "@/components/theme-provider";
import { TESTIMONIAL_PATH } from "@/features/testimonials/constants";

const LANGUAGES = [
  { value: "id", label: "Indonesia" },
  { value: "en", label: "English" },
] as const;

/** Header profile menu: account identity (when logged in), language + dark mode
 *  toggles, and the auth action (log out, or log in / sign up) at the bottom. */
export function UserMenu() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, user, signOut } = useAuth();
  const { isAdmin } = usePremiumAccess();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const currentLang = i18n.language.split("-")[0];
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await signOut();
    toast.success(t("auth.logout_success"));
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              aria-label={t("auth.account_label")}
              className="flex justify-center border border-accent-foreground/20! py-4! bg-card! hover:bg-accent! cursor-pointer"
            />
          }
        >
          <User className="h-4 w-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48 text-foreground">
          {!isAuthenticated ? (
            <>
              <div className="p-1 space-y-1.5">
                <DropdownMenuItem
                  onClick={() => navigate("/login")}
                  className="text-xs cursor-pointer font-bold bg-primary text-primary-foreground hover:bg-primary/80 focus:bg-primary/80 focus:text-primary-foreground justify-center h-9 rounded-lg flex items-center gap-1.5 transition-all border-0 tracking-tight"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  {t("auth.login_btn")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/register")}
                  className="text-xs cursor-pointer font-bold bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] focus:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] focus:text-secondary-foreground justify-center h-9 rounded-lg flex items-center gap-1.5 transition-all border-0 tracking-tight"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {t("auth.signup_btn")}
                </DropdownMenuItem>
              </div>

              <DropdownMenuSeparator />
            </>
          ) : (
            <>
              {user?.email && (
                <>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {t("auth.account_label")}
                      </span>
                      <span className="truncate text-xs font-normal text-foreground">
                        {user.email}
                      </span>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                </>
              )}

              {isAdmin && (
                <>
                  <DropdownMenuItem
                    onClick={() => navigate("/admin")}
                    className="text-xs cursor-pointer"
                  >
                    <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                    {t("admin.console_entry", "Kelola Sistem")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => navigate(TESTIMONIAL_PATH)}
                  className="text-xs cursor-pointer"
                >
                  <MessageSquareQuote className="h-4 w-4 text-muted-foreground" />
                  {t("testimonials.menu_entry", "Ulasan Pribadi")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Shared settings (available to everyone) */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs cursor-pointer">
              <Languages className="h-4 w-4 text-muted-foreground" />
              {t("common.language")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={currentLang}
                onValueChange={(v) => v && i18n.changeLanguage(v)}
              >
                {LANGUAGES.map((lang) => (
                  <DropdownMenuRadioItem
                    key={lang.value}
                    value={lang.value}
                    className="text-xs cursor-pointer"
                  >
                    {lang.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs cursor-pointer">
              <Moon className="h-4 w-4 text-muted-foreground" />
              {t("common.theme")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(v) =>
                  v && setTheme(v as "light" | "dark" | "system")
                }
              >
                <DropdownMenuRadioItem
                  value="light"
                  className="text-xs cursor-pointer"
                >
                  {t("common.theme_light")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="dark"
                  className="text-xs cursor-pointer"
                >
                  {t("common.theme_dark")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="system"
                  className="text-xs cursor-pointer"
                >
                  {t("common.theme_system")}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {isAuthenticated && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setShowLogoutConfirm(true)}
                className="text-xs cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                {t("auth.logout_btn")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
              <LogOut />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {t("auth.logout_confirm_title", { defaultValue: "Keluar?" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("auth.logout_confirm_desc", { defaultValue: "Apakah Anda yakin ingin keluar dari akun Anda?" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleLogout}>
              {t("auth.logout_btn", "Keluar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
