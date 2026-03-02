-- =============================================================================
-- Migration: 0005_friendship_delete_policy
-- Description: Allow users to remove friendships they are a party to.
--
-- Either the requester or the addressee may delete the friendship row.
-- =============================================================================

create policy "friendships: participants can delete"
  on public.friendships for delete
  using (requester_id = auth.uid() or addressee_id = auth.uid());
