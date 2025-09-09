"use client";

import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Wand2, Loader2, Sparkles } from 'lucide-react';
import { suggestContent, SuggestContentOutput } from '@/ai/flows/suggest-content';
import { Badge } from '@/components/ui/badge';

export function ContentSuggester() {
  const [description, setDescription] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestContentOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSuggest = async () => {
    if (!description.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please describe what you want to watch.',
      });
      return;
    }
    setIsLoading(true);
    setSuggestions(null);
    try {
      const result = await suggestContent({ description });
      setSuggestions(result);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'AI Suggestion Failed',
        description: 'Could not get suggestions. Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1" className="border-b-0">
        <AccordionTrigger className="p-4 hover:no-underline">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            <span className="font-semibold">Need a movie idea?</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="p-4 pt-0">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Describe the kind of movie you're in the mood for, and our AI will give you some suggestions.
            </p>
            <Textarea
              placeholder="e.g., a funny sci-fi movie from the 90s with aliens"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-input"
            />
            <Button onClick={handleSuggest} disabled={isLoading} className="w-full" variant="secondary">
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Suggest Movies
            </Button>
            {suggestions && suggestions.movieSuggestions.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-muted-foreground">Here are some ideas:</h4>
                <div className="flex flex-wrap gap-2">
                  {suggestions.movieSuggestions.map((movie, index) => (
                    <Badge key={index} variant="outline" className="text-base py-1 px-3">
                      {movie}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
