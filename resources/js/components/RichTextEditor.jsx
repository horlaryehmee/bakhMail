import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo2,
  RemoveFormatting,
  Underline,
  Undo2,
} from 'lucide-react';

function normalizeHtml(html) {
  const value = String(html || '').trim();

  if (!value) {
    return '<p></p>';
  }

  return value;
}

function plainTextFromHtml(html) {
  const node = document.createElement('div');
  node.innerHTML = normalizeHtml(html);

  return (node.textContent || node.innerText || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function RichTextEditor({ value, onChange, minHeight = 260, placeholder = 'Write your email...' }) {
  const editorRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const normalizedValue = useMemo(() => normalizeHtml(value), [value]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    if (editorRef.current.innerHTML !== normalizedValue) {
      editorRef.current.innerHTML = normalizedValue;
    }
  }, [normalizedValue]);

  function emitChange() {
    if (!editorRef.current) {
      return;
    }

    const html = normalizeHtml(editorRef.current.innerHTML);
    const text = plainTextFromHtml(html);

    onChange({
      html,
      text,
    });
  }

  function focusEditor() {
    editorRef.current?.focus();
  }

  function run(command, commandValue = null) {
    focusEditor();
    document.execCommand(command, false, commandValue);
    emitChange();
  }

  function applyHeading(tagName) {
    run('formatBlock', tagName);
  }

  function addLink() {
    const url = window.prompt('Enter link URL');

    if (!url) {
      return;
    }

    run('createLink', url);
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-3">
        <button className="ghost-button !px-3 !py-2" type="button" onClick={() => applyHeading('H1')}>
          <Heading1 size={16} />
        </button>
        <button className="ghost-button !px-3 !py-2" type="button" onClick={() => applyHeading('H2')}>
          <Heading2 size={16} />
        </button>
        <button className="ghost-button !px-3 !py-2" type="button" onClick={() => run('bold')}>
          <Bold size={16} />
        </button>
        <button className="ghost-button !px-3 !py-2" type="button" onClick={() => run('italic')}>
          <Italic size={16} />
        </button>
        <button className="ghost-button !px-3 !py-2" type="button" onClick={() => run('underline')}>
          <Underline size={16} />
        </button>
        <button className="ghost-button !px-3 !py-2" type="button" onClick={() => run('insertUnorderedList')}>
          <List size={16} />
        </button>
        <button className="ghost-button !px-3 !py-2" type="button" onClick={() => run('insertOrderedList')}>
          <ListOrdered size={16} />
        </button>
        <button className="ghost-button !px-3 !py-2" type="button" onClick={() => run('justifyLeft')}>
          <AlignLeft size={16} />
        </button>
        <button className="ghost-button !px-3 !py-2" type="button" onClick={() => run('justifyCenter')}>
          <AlignCenter size={16} />
        </button>
        <button className="ghost-button !px-3 !py-2" type="button" onClick={() => run('justifyRight')}>
          <AlignRight size={16} />
        </button>
        <button className="ghost-button !px-3 !py-2" type="button" onClick={addLink}>
          <LinkIcon size={16} />
        </button>
        <button className="ghost-button !px-3 !py-2" type="button" onClick={() => run('removeFormat')}>
          <RemoveFormatting size={16} />
        </button>
        <button className="ghost-button !px-3 !py-2" type="button" onClick={() => run('undo')}>
          <Undo2 size={16} />
        </button>
        <button className="ghost-button !px-3 !py-2" type="button" onClick={() => run('redo')}>
          <Redo2 size={16} />
        </button>
      </div>

      <div className="relative">
        {!mounted || plainTextFromHtml(normalizedValue) ? null : (
          <div className="pointer-events-none absolute left-4 top-4 text-sm text-slate-400">{placeholder}</div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[260px] w-full px-4 py-4 text-sm leading-7 text-slate-800 outline-none [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_a]:text-blue-600 [&_a]:underline [&_ol]:ml-6 [&_ol]:list-decimal [&_p]:mb-4 [&_ul]:ml-6 [&_ul]:list-disc"
          style={{ minHeight }}
          onInput={emitChange}
          onBlur={emitChange}
        />
      </div>
    </div>
  );
}
