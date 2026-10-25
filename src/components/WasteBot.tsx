'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, ImagePlus, Send, X } from 'lucide-react';
import Link from 'next/link';

type Message = { role: 'user' | 'assistant'; content: string };
const chips = ['What can I sell?', 'Plastic rates', 'E-waste', 'Prohibited items'];

export default function WasteBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  async function sendMessage(text = input, photo?: File) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    let image: { mediaType: string; data: string } | undefined;
    if (photo) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size > 5 * 1024 * 1024) {
        setError('Choose a JPEG, PNG, or WebP photo under 5 MB.');
        return;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read that photo.'));
        reader.readAsDataURL(photo);
      });
      image = { mediaType: photo.type, data: dataUrl.split(',')[1] };
    }
    const next = [...messages, { role: 'user' as const, content: photo ? `${trimmed} [Photo attached]` : trimmed, ...(image ? { image } : {}) }];
    setMessages([...next, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      if (!response.ok || !response.body) {
        const data = await response.json();
        throw new Error(data.error || 'WasteBot could not reply.');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let answer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n/);
        buffer = parts.pop() || '';
        for (const line of parts) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.delta?.type === 'text_delta') {
              answer += event.delta.text;
              setMessages([...next, { role: 'assistant', content: answer }]);
            }
          } catch (parseError) {
            console.error('Could not parse WasteBot stream event:', parseError);
          }
        }
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'WasteBot could not reply.');
      setMessages(next);
    } finally {
      setBusy(false);
    }
  }

  function renderReply(content: string) {
    const segments = content.split(/(\[[^\]]+\]\(\/listings\/[^)]+\))/g);
    return segments.map((segment, index) => {
      const match = segment.match(/^\[([^\]]+)\]\((\/listings\/[^)]+)\)$/);
      return match ? <Link key={index} className="font-semibold text-emerald-700 underline" href={match[2]}>{match[1]}</Link> : segment;
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage();
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Open WasteBot" className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-white shadow-xl hover:bg-emerald-800">
      <Bot size={25} />
    </button>
    {open && <div className="fixed inset-0 z-[70] flex flex-col bg-white sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(680px,85vh)] sm:w-[390px] sm:rounded-2xl sm:border sm:shadow-2xl">
      <header className="flex items-center justify-between bg-emerald-800 px-4 py-3 text-white sm:rounded-t-2xl">
        <div><p className="font-bold">WasteBot</p><p className="text-xs text-emerald-100">Your recycling guide</p></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close WasteBot"><X /></button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {!messages.length && <div className="flex flex-wrap gap-2">{chips.map((chip) => <button type="button" key={chip} onClick={() => void sendMessage(chip)} className="rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800">{chip}</button>)}</div>}
        {messages.map((message, index) => <div key={index} className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${message.role === 'user' ? 'ml-auto bg-emerald-700 text-white' : 'bg-slate-100 text-slate-800'}`}>{renderReply(message.content || (busy && index === messages.length - 1 ? '…' : ''))}</div>)}
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div ref={endRef} />
      </div>
      <div className="border-t p-3">
        <form onSubmit={submit} className="flex items-center gap-2">
          <label className="cursor-pointer text-slate-500" title="Attach waste photo"><ImagePlus size={20} /><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void sendMessage('Please identify this waste photo and tell me how it can be recycled.', file); event.currentTarget.value = ''; }} /></label>
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about recycling…" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" />
          <button disabled={busy || !input.trim()} className="rounded-lg bg-emerald-700 p-2 text-white disabled:opacity-40" aria-label="Send message"><Send size={17} /></button>
        </form>
      </div>
    </div>}
  </>;
}
