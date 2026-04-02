import { useState, useEffect } from "react";
import { Search, User as UserIcon, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import api from "@/lib/api";
import { prefetchProfile } from "@/lib/prefetchData";

export default function UserSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    const fetchResults = async () => {
      if (!query.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data } = await api.get(`/profiles?q=${query}`);
        setResults(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchResults, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <>
      <div 
        onClick={() => setOpen(true)}
        className="px-4 pb-2"
      >
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl glass-subtle text-muted-foreground text-sm cursor-pointer hover:border-primary/30 transition-all">
          <Search className="w-4 h-4" />
          <span className="text-xs">Поиск... <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd></span>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 shadow-lg max-w-lg">
          <div className="sr-only">
            <DialogTitle>Поиск пользователей</DialogTitle>
            <DialogDescription>Введите имя или @username для поиска людей в СЛОЕ</DialogDescription>
          </div>
          <Command shouldFilter={false} className="rounded-none border-none">
            <CommandInput 
              placeholder="Поиск по имени или @username..." 
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {loading && (
                <div className="py-6 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
              )}
              {!loading && results.length === 0 && query && (
                <CommandEmpty>Пользователи не найдены.</CommandEmpty>
              )}
              <CommandGroup heading="Пользователи">
                {results.map((profile) => (
                  <CommandItem
                    key={profile.id}
                    value={profile.username}
                    onMouseEnter={() => prefetchProfile(profile.user_id)}
                    onSelect={() => {
                      navigate(`/profile/${profile.user_id}`);
                      setOpen(false);
                    }}
                    className="flex items-center gap-3 p-3 cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-xl bg-gradient-subtle flex items-center justify-center overflow-hidden">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{profile.first_name} {profile.last_name}</span>
                      <span className="text-xs text-muted-foreground">@{profile.username}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
