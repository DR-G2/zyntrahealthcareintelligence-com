import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { sm2, QUALITY_MAP, type QualityLabel } from '@/lib/sm2';
import {
  Plus, Brain, ArrowLeft, RotateCcw, Sparkles, Loader2,
  BookOpen, Clock, Layers, ChevronRight,
} from 'lucide-react';

type Phase = 'decks' | 'review' | 'create-deck' | 'add-card';

interface Deck {
  id: string;
  title: string;
  subject: string | null;
  card_count: number;
  created_at: string;
  due_count?: number;
}

interface FlashcardWithReview {
  id: string;
  front: string;
  back: string;
  subject: string | null;
  review?: {
    id: string;
    ease_factor: number;
    interval_days: number;
    repetitions: number;
    next_review_at: string;
  };
}

export default function Flashcards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>('decks');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [reviewQueue, setReviewQueue] = useState<FlashcardWithReview[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Create deck form
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [newDeckSubject, setNewDeckSubject] = useState('');

  // Add card form
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardBack, setNewCardBack] = useState('');

  const loadDecks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('flashcard_decks' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      // Get due counts
      const now = new Date().toISOString();
      const { data: reviews } = await supabase
        .from('flashcard_reviews' as any)
        .select('flashcard_id, next_review_at')
        .eq('user_id', user.id)
        .lte('next_review_at', now);

      const { data: allCards } = await supabase
        .from('flashcards' as any)
        .select('id, deck_id');

      const reviewedIds = new Set((reviews as any[] || []).map((r: any) => r.flashcard_id));
      const allReviewedCards = new Set((await supabase.from('flashcard_reviews' as any).select('flashcard_id').eq('user_id', user!.id)).data?.map((r: any) => r.flashcard_id) || []);

      const deckDueCounts: Record<string, number> = {};
      (allCards as any[] || []).forEach((card: any) => {
        if (!deckDueCounts[card.deck_id]) deckDueCounts[card.deck_id] = 0;
        // Card is due if: has a review that's due, OR has no review yet (new card)
        if (reviewedIds.has(card.id) || !allReviewedCards.has(card.id)) {
          deckDueCounts[card.deck_id]++;
        }
      });

      setDecks((data as any[]).map((d: any) => ({ ...d, due_count: deckDueCounts[d.id] || 0 })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadDecks(); }, [loadDecks]);

  const createDeck = async () => {
    if (!user || !newDeckTitle.trim()) return;
    await (supabase.from('flashcard_decks' as any) as any).insert({
      user_id: user.id,
      title: newDeckTitle.trim(),
      subject: newDeckSubject.trim() || null,
    });
    setNewDeckTitle('');
    setNewDeckSubject('');
    setPhase('decks');
    loadDecks();
    toast({ title: 'Deck created' });
  };

  const addCard = async () => {
    if (!activeDeck || !newCardFront.trim() || !newCardBack.trim()) return;
    await (supabase.from('flashcards' as any) as any).insert({
      deck_id: activeDeck.id,
      front: newCardFront.trim(),
      back: newCardBack.trim(),
      subject: activeDeck.subject,
    });
    // Update card count
    await supabase.from('flashcard_decks' as any).update({ card_count: (activeDeck.card_count || 0) + 1 } as any).eq('id', activeDeck.id);
    setNewCardFront('');
    setNewCardBack('');
    toast({ title: 'Card added' });
  };

  const startReview = async (deck: Deck) => {
    if (!user) return;
    setActiveDeck(deck);
    setLoading(true);

    // Get all cards in deck
    const { data: cards } = await supabase
      .from('flashcards' as any)
      .select('*')
      .eq('deck_id', deck.id);

    if (!cards || (cards as any[]).length === 0) {
      toast({ title: 'No cards in this deck', description: 'Add some cards first.' });
      setLoading(false);
      return;
    }

    // Get reviews for these cards
    const cardIds = (cards as any[]).map((c: any) => c.id);
    const { data: reviews } = await supabase
      .from('flashcard_reviews' as any)
      .select('*')
      .eq('user_id', user.id)
      .in('flashcard_id', cardIds);

    const reviewMap: Record<string, any> = {};
    (reviews as any[] || []).forEach((r: any) => { reviewMap[r.flashcard_id] = r; });

    const now = new Date();
    const queue = (cards as any[])
      .map((c: any) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        subject: c.subject,
        review: reviewMap[c.id] || undefined,
      }))
      .filter((c: FlashcardWithReview) => {
        if (!c.review) return true; // New card
        return new Date(c.review.next_review_at) <= now;
      })
      .sort((a: FlashcardWithReview, b: FlashcardWithReview) => {
        if (!a.review) return -1;
        if (!b.review) return 1;
        return new Date(a.review.next_review_at).getTime() - new Date(b.review.next_review_at).getTime();
      });

    setReviewQueue(queue);
    setCurrentIndex(0);
    setShowAnswer(false);
    setPhase('review');
    setLoading(false);
  };

  const rateCard = async (quality: QualityLabel) => {
    if (!user) return;
    const card = reviewQueue[currentIndex];
    const currentState = card.review
      ? { easeFactor: Number(card.review.ease_factor), interval: card.review.interval_days, repetitions: card.review.repetitions }
      : { easeFactor: 2.5, interval: 0, repetitions: 0 };

    const result = sm2(currentState, QUALITY_MAP[quality]);

    if (card.review) {
      await supabase.from('flashcard_reviews' as any).update({
        ease_factor: result.easeFactor,
        interval_days: result.interval,
        repetitions: result.repetitions,
        next_review_at: result.nextReviewAt.toISOString(),
        updated_at: new Date().toISOString(),
      } as any).eq('id', card.review.id);
    } else {
      await (supabase.from('flashcard_reviews' as any) as any).insert({
        user_id: user.id,
        flashcard_id: card.id,
        ease_factor: result.easeFactor,
        interval_days: result.interval,
        repetitions: result.repetitions,
        next_review_at: result.nextReviewAt.toISOString(),
      });
    }

    if (currentIndex < reviewQueue.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
    } else {
      toast({ title: '🎉 Review complete!', description: `You reviewed ${reviewQueue.length} cards.` });
      setPhase('decks');
      loadDecks();
    }
  };

  const generateFromMistakes = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const resp = await supabase.functions.invoke('generate-flashcards', {
        body: { user_id: user.id },
      });
      if (resp.error) throw resp.error;
      const result = resp.data;
      toast({ title: `Generated ${result?.cards_created || 0} flashcards`, description: result?.deck_title ? `Added to "${result.deck_title}"` : undefined });
      loadDecks();
    } catch (err) {
      console.error(err);
      toast({ title: 'Generation failed', description: 'Could not generate flashcards. Try again later.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const totalDue = decks.reduce((sum, d) => sum + (d.due_count || 0), 0);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {phase === 'decks' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold font-display">Flashcards</h1>
                <p className="text-sm text-muted-foreground">Spaced repetition for long-term retention</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={generateFromMistakes} disabled={generating} className="gap-1.5">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate from Mistakes
                </Button>
                <Button size="sm" onClick={() => setPhase('create-deck')} className="gap-1.5">
                  <Plus className="h-4 w-4" /> New Deck
                </Button>
              </div>
            </div>

            {totalDue > 0 && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-4 pb-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{totalDue} cards due for review</p>
                    <p className="text-xs text-muted-foreground">Keep your streaks going!</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : decks.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">No flashcard decks yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">Create a deck manually or generate cards from your mistakes.</p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={generateFromMistakes} disabled={generating} className="gap-1.5">
                      <Sparkles className="h-4 w-4" /> Generate from Mistakes
                    </Button>
                    <Button onClick={() => setPhase('create-deck')} className="gap-1.5">
                      <Plus className="h-4 w-4" /> Create Deck
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {decks.map(deck => (
                  <Card key={deck.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => startReview(deck)}>
                    <CardContent className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Layers className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{deck.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {deck.subject && <Badge variant="outline" className="text-[10px]">{deck.subject}</Badge>}
                            <span>{deck.card_count} cards</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {(deck.due_count || 0) > 0 && (
                          <Badge className="bg-primary/10 text-primary border-0">{deck.due_count} due</Badge>
                        )}
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setActiveDeck(deck); setPhase('add-card'); }}>
                          <Plus className="h-4 w-4" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {phase === 'create-deck' && (
          <>
            <Button variant="ghost" size="sm" onClick={() => setPhase('decks')} className="gap-1.5 mb-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Create New Deck</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Title</label>
                  <Input value={newDeckTitle} onChange={e => setNewDeckTitle(e.target.value)} placeholder="e.g. Cardiology Key Concepts" />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Subject (optional)</label>
                  <Input value={newDeckSubject} onChange={e => setNewDeckSubject(e.target.value)} placeholder="e.g. Medicine" />
                </div>
                <Button onClick={createDeck} disabled={!newDeckTitle.trim()}>Create Deck</Button>
              </CardContent>
            </Card>
          </>
        )}

        {phase === 'add-card' && activeDeck && (
          <>
            <Button variant="ghost" size="sm" onClick={() => { setPhase('decks'); setActiveDeck(null); }} className="gap-1.5 mb-2">
              <ArrowLeft className="h-4 w-4" /> Back to {activeDeck.title}
            </Button>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Card to "{activeDeck.title}"</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Front (Question/Concept)</label>
                  <Textarea value={newCardFront} onChange={e => setNewCardFront(e.target.value)} placeholder="What is the first-line treatment for community-acquired pneumonia?" rows={3} />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Back (Answer/Explanation)</label>
                  <Textarea value={newCardBack} onChange={e => setNewCardBack(e.target.value)} placeholder="Amoxicillin 500mg TDS for 5 days (NICE guidelines)" rows={3} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={addCard} disabled={!newCardFront.trim() || !newCardBack.trim()}>Add Card</Button>
                  <Button variant="outline" onClick={() => startReview(activeDeck)}>Start Review</Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {phase === 'review' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <Button variant="ghost" size="sm" onClick={() => { setPhase('decks'); loadDecks(); }} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Exit Review
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} / {reviewQueue.length}
              </span>
            </div>
            <Progress value={((currentIndex + 1) / reviewQueue.length) * 100} className="h-1.5 mb-4" />

            {reviewQueue.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
                  <p className="text-sm text-muted-foreground">No cards due for review right now. Check back later.</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="min-h-[300px]">
                <CardContent className="pt-8 pb-6 flex flex-col items-center justify-center text-center">
                  <div className="mb-6 max-w-lg">
                    <p className="text-lg font-medium">{reviewQueue[currentIndex].front}</p>
                  </div>

                  {showAnswer ? (
                    <>
                      <div className="w-full border-t border-border my-4" />
                      <div className="mb-8 max-w-lg">
                        <p className="text-base text-muted-foreground">{reviewQueue[currentIndex].back}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-center">
                        <Button variant="destructive" size="sm" onClick={() => rateCard('again')} className="min-w-[80px]">
                          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Again
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => rateCard('hard')} className="min-w-[80px]">Hard</Button>
                        <Button variant="secondary" size="sm" onClick={() => rateCard('good')} className="min-w-[80px]">Good</Button>
                        <Button size="sm" onClick={() => rateCard('easy')} className="min-w-[80px] bg-green-600 hover:bg-green-700 text-white">Easy</Button>
                      </div>
                    </>
                  ) : (
                    <Button onClick={() => setShowAnswer(true)} size="lg" className="mt-4">
                      Show Answer
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
