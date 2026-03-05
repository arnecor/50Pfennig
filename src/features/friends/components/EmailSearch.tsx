/**
 * features/friends/components/EmailSearch.tsx
 *
 * Email search form for finding and adding registered users.
 * Performs an exact email match via the search_user_by_email RPC.
 *
 * States: empty, loading, found (with add button), not found,
 * already friends, successfully added.
 */

import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { useAddFriendById } from '@features/friends/hooks/useAddFriendById';
import { useSearchByEmail } from '@features/friends/hooks/useSearchByEmail';
import { Check, Loader2, Search, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function EmailSearch() {
  const { t } = useTranslation();
  const searchByEmail = useSearchByEmail();
  const addFriend = useAddFriendById();

  const [email, setEmail] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState('');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setHasSearched(true);
    setAdded(false);
    setAddError('');
    searchByEmail.mutate(trimmed);
  }

  async function handleAdd() {
    if (!searchByEmail.data) return;
    setAddError('');

    try {
      await addFriend.mutateAsync(searchByEmail.data.userId);
      setAdded(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('P0004')) {
        setAddError(t('friends.email_already_friends'));
      } else {
        setAddError(t('friends.invite_error_generic'));
      }
    }
  }

  function handleClear() {
    setEmail('');
    setHasSearched(false);
    setAdded(false);
    setAddError('');
    searchByEmail.reset();
  }

  return (
    <div className="space-y-4">
      {/* Search form */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="email"
            placeholder={t('friends.email_search_placeholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-9 pr-8"
            autoCapitalize="off"
            autoCorrect="off"
          />
          {email && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit" disabled={!email.trim() || searchByEmail.isPending}>
          {searchByEmail.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t('friends.email_search_button')
          )}
        </Button>
      </form>

      {/* Results */}
      {hasSearched && !searchByEmail.isPending && (
        <>
          {/* User found */}
          {searchByEmail.data && !added && (
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {searchByEmail.data.displayName[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {searchByEmail.data.displayName}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {searchByEmail.data.email}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={handleAdd}
                  disabled={addFriend.isPending}
                >
                  {addFriend.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      {t('friends.friend_add_button')}
                    </>
                  )}
                </Button>
              </div>
              {addError && (
                <p className="mt-2 text-sm text-destructive">{addError}</p>
              )}
            </div>
          )}

          {/* Successfully added */}
          {added && searchByEmail.data && (
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
              <Check className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
              <p className="font-medium text-green-800 dark:text-green-200">
                {t('friends.friend_added', { name: searchByEmail.data.displayName })}
              </p>
            </div>
          )}

          {/* Not found */}
          {!searchByEmail.data && !searchByEmail.isError && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t('friends.email_not_found')}
            </p>
          )}

          {/* Search error */}
          {searchByEmail.isError && (
            <p className="py-4 text-center text-sm text-destructive">
              {t('friends.invite_error_generic')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
