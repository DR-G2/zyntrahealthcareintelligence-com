import { useState, useEffect } from 'react';
import { Users, Plus, UserPlus, Trash2, Loader2, Mail, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { ListSkeleton } from '@/components/skeletons/PageSkeleton';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';

interface GroupMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  email?: string;
  name?: string;
}

interface Group {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  members: GroupMember[];
}

interface FoundUser {
  id: string;
  email: string | null;
  name: string | null;
}

export default function SocialGroups() {
  const { user } = useAuth();
  const gate = useFeatureGate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteGroupId, setInviteGroupId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Friend search state
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [searchDone, setSearchDone] = useState(false);
  const [addToGroupId, setAddToGroupId] = useState('');
  const [addingToGroup, setAddingToGroup] = useState(false);

  useEffect(() => { if (user) loadGroups(); }, [user]);

  const loadGroups = async () => {
    if (!user) return;
    setLoading(true);

    const { data: memberships } = await supabase
      .from('study_group_members')
      .select('group_id')
      .eq('user_id', user.id);

    const groupIds = memberships?.map(m => m.group_id) || [];

    const { data: ownedGroups } = await supabase
      .from('study_groups')
      .select('*')
      .eq('created_by', user.id);

    const allGroupIds = [...new Set([...groupIds, ...(ownedGroups?.map(g => g.id) || [])])];

    if (allGroupIds.length === 0) { setGroups([]); setLoading(false); return; }

    const { data: groupsData } = await supabase
      .from('study_groups')
      .select('*')
      .in('id', allGroupIds);

    if (!groupsData) { setGroups([]); setLoading(false); return; }

    const groupsWithMembers: Group[] = await Promise.all(
      groupsData.map(async (g) => {
        const { data: members } = await supabase
          .from('study_group_members')
          .select('*')
          .eq('group_id', g.id);

        const memberUserIds = members?.map(m => m.user_id) || [];
        let profiles: any[] = [];
        if (memberUserIds.length > 0) {
          const { data: p } = await supabase
            .from('profiles')
            .select('id, email, name')
            .in('id', memberUserIds);
          profiles = p || [];
        }

        return {
          ...g,
          members: (members || []).map(m => {
            const profile = profiles.find(p => p.id === m.user_id);
            return { ...m, email: profile?.email, name: profile?.name };
          }),
        };
      })
    );

    setGroups(groupsWithMembers);
    setLoading(false);
  };

  const createGroup = async () => {
    if (!user || !newGroupName.trim()) return;
    setCreating(true);

    const { data: group, error } = await supabase
      .from('study_groups')
      .insert({ name: newGroupName.trim(), created_by: user.id })
      .select()
      .single();

    if (error) { toast.error('Failed to create group'); setCreating(false); return; }

    await supabase.from('study_group_members').insert({
      group_id: group.id, user_id: user.id, role: 'owner',
    });

    toast.success('Group created!');
    setNewGroupName('');
    setShowCreate(false);
    setCreating(false);
    loadGroups();
  };

  const inviteMember = async () => {
    if (!user || !inviteEmail.trim() || !inviteGroupId) return;
    setInviting(true);

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', inviteEmail.trim().toLowerCase())
      .single();

    if (!profile) {
      toast.error('No user found with that email. They must be registered first.');
      setInviting(false);
      return;
    }

    if (profile.id === user.id) {
      toast.error("You're already in this group!");
      setInviting(false);
      return;
    }

    const { error } = await supabase.from('study_group_members').insert({
      group_id: inviteGroupId, user_id: profile.id, role: 'member',
    });

    if (error) {
      if (error.code === '23505') toast.error('User is already in this group');
      else toast.error('Failed to add member');
      setInviting(false);
      return;
    }

    toast.success(`Added ${profile.email} to the group!`);
    setInviteEmail('');
    setInviteGroupId(null);
    setInviting(false);
    loadGroups();
  };

  const removeMember = async (groupId: string, memberId: string) => {
    await supabase.from('study_group_members').delete().eq('id', memberId);
    toast.success('Member removed');
    loadGroups();
  };

  const deleteGroup = async (groupId: string) => {
    await supabase.from('study_groups').delete().eq('id', groupId);
    toast.success('Group deleted');
    loadGroups();
  };

  const searchFriend = async () => {
    if (!user || !searchEmail.trim()) return;
    setSearching(true);
    setFoundUser(null);
    setSearchDone(false);

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, name')
      .eq('email', searchEmail.trim().toLowerCase())
      .single();

    if (profile && profile.id !== user.id) {
      setFoundUser(profile);
    }
    setSearchDone(true);
    setSearching(false);
  };

  const addFoundUserToGroup = async () => {
    if (!foundUser || !addToGroupId) return;
    setAddingToGroup(true);

    const { error } = await supabase.from('study_group_members').insert({
      group_id: addToGroupId, user_id: foundUser.id, role: 'member',
    });

    if (error) {
      if (error.code === '23505') toast.error('User is already in this group');
      else toast.error('Failed to add member');
      setAddingToGroup(false);
      return;
    }

    toast.success(`Added ${foundUser.email || foundUser.name} to the group!`);
    setFoundUser(null);
    setSearchEmail('');
    setSearchDone(false);
    setAddToGroupId('');
    setAddingToGroup(false);
    loadGroups();
  };

  const ownedGroups = groups.filter(g => g.created_by === user?.id);

  return (
    <AppLayout>
      {!gate.canAccessSocialGroups ? (
        <div className="mx-auto max-w-xl py-12">
          <UpgradePrompt feature="Social Study Groups" description="Create and join study groups with other candidates. Available on the Full Access plan." />
        </div>
      ) : (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display">Social Groups</h1>
            <p className="text-sm text-muted-foreground mt-1">Create study groups and invite friends by email</p>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New Group</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Study Group</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <Input placeholder="Group name" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
                <Button onClick={createGroup} disabled={creating || !newGroupName.trim()} className="w-full">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Group
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Find Friends Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              Find Friends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search by email address..."
                  type="email"
                  value={searchEmail}
                  onChange={e => { setSearchEmail(e.target.value); setSearchDone(false); setFoundUser(null); }}
                  onKeyDown={e => e.key === 'Enter' && searchFriend()}
                />
                <Button onClick={searchFriend} disabled={searching || !searchEmail.trim()} variant="outline">
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              {searchDone && !foundUser && (
                <p className="text-sm text-muted-foreground">No registered user found with that email.</p>
              )}

              {foundUser && (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                      {(foundUser.name || foundUser.email || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{foundUser.name || 'Unknown'}</p>
                      {foundUser.email && <p className="text-xs text-muted-foreground">{foundUser.email}</p>}
                    </div>
                  </div>
                  {ownedGroups.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <Select value={addToGroupId} onValueChange={setAddToGroupId}>
                        <SelectTrigger className="w-40 h-8 text-xs">
                          <SelectValue placeholder="Select group" />
                        </SelectTrigger>
                        <SelectContent>
                          {ownedGroups.map(g => (
                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={addFoundUserToGroup} disabled={!addToGroupId || addingToGroup}>
                        {addingToGroup ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Create a group first to invite</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <ListSkeleton items={2} />
        ) : groups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg">No Groups Yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Create a study group to start collaborating with friends</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {groups.map(group => (
              <Card key={group.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      {group.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {group.created_by === user?.id && (
                        <>
                          <Dialog open={inviteGroupId === group.id} onOpenChange={(o) => { if (!o) setInviteGroupId(null); }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => setInviteGroupId(group.id)}>
                                <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Invite
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader><DialogTitle>Invite Member</DialogTitle></DialogHeader>
                              <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Registered email address</label>
                                  <Input
                                    placeholder="friend@email.com"
                                    type="email"
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                  />
                                </div>
                                <Button onClick={inviteMember} disabled={inviting || !inviteEmail.trim()} className="w-full">
                                  {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                                  Add to Group
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteGroup(group.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {group.members.map(member => (
                      <div key={member.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                            {(member.name || member.email || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{member.name || member.email || 'Unknown'}</p>
                            {member.name && member.email && <p className="text-xs text-muted-foreground">{member.email}</p>}
                          </div>
                          {member.role === 'owner' && <Badge variant="secondary" className="text-[10px]">Owner</Badge>}
                        </div>
                        {group.created_by === user?.id && member.user_id !== user?.id && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMember(group.id, member.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      )}
    </AppLayout>
  );
}
