import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  BookOpen, 
  CheckSquare, 
  FileText, 
  Presentation, 
  GraduationCap, 
  Send, 
  Mic, 
  Volume2, 
  Download, 
  Plus, 
  History, 
  ChevronRight,
  Loader2,
  Paperclip,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import pptxgen from 'pptxgenjs';
import { cn } from './lib/utils';
import { 
  generateText, 
  generateTTS, 
  generateCourse, 
  generateQuiz, 
  generateExam, 
  generateDocSlides, 
  generatePPTSlides 
} from './services/gemini';

// --- Types ---
type View = 'chat' | 'course' | 'quiz' | 'exam' | 'doc' | 'ppt';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 group",
      active 
        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
        : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
    )}
  >
    <Icon size={20} className={cn(active ? "text-white" : "text-slate-400 group-hover:text-indigo-600")} />
    <span className="font-medium">{label}</span>
  </button>
);

const ReadingButton = ({ text }: { text: string }) => {
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleRead = async () => {
    if (loading) return;
    setLoading(true);
    const base64 = await generateTTS(text);
    if (base64) {
      const audio = new Audio(`data:audio/mp3;base64,${base64}`);
      audioRef.current = audio;
      audio.play();
    }
    setLoading(false);
  };

  return (
    <button 
      onClick={handleRead}
      disabled={loading}
      className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
      title="Read aloud"
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : <Volume2 size={18} />}
    </button>
  );
};

export default function App() {
  const [currentView, setCurrentView] = useState<View>('chat');
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const userMsg: Message = { 
        role: 'user', 
        content: `Uploaded file: ${file.name}\n\nContent:\n${text.substring(0, 2000)}...`, 
        timestamp: Date.now() 
      };
      setChatHistory(prev => [...prev, userMsg]);
      
      try {
        const response = await generateText(`Please summarize this file: ${file.name}\n\n${text}`, chatHistory);
        const aiMsg: Message = { role: 'assistant', content: response || "I've analyzed your file.", timestamp: Date.now() };
        setChatHistory(prev => [...prev, aiMsg]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };
  // Course State
  const [courseTopic, setCourseTopic] = useState('');
  const [courseLevel, setCourseLevel] = useState('Beginner');
  const [courseData, setCourseData] = useState<{
    title: string;
    description: string;
    objectives: string[];
    lessons: { id: number; title: string; content: string; summary: string }[];
  } | null>(null);
  const [activeLessonIndex, setActiveLessonIndex] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);

  // Quiz State
  const [quizTopic, setQuizTopic] = useState('');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // Exam State
  const [examTopic, setExamTopic] = useState('');
  const [examQuestions, setExamQuestions] = useState<QuizQuestion[]>([]);

  // Doc State
  const [docTopic, setDocTopic] = useState('');
  const [docSlides, setDocSlides] = useState<{title: string, content: string}[]>([]);

  // PPT State
  const [pptTopic, setPptTopic] = useState('');
  const [pptSlides, setPptSlides] = useState<{title: string, bullets: string[]}[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('edu_chat_history');
    if (saved) setChatHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('edu_chat_history', JSON.stringify(chatHistory));
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', content: input, timestamp: Date.now() };
    setChatHistory(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await generateText(input, chatHistory);
      const aiMsg: Message = { role: 'assistant', content: response || "I'm sorry, I couldn't process that.", timestamp: Date.now() };
      setChatHistory(prev => [...prev, aiMsg]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;
      recorder.start();
      setIsRecording(true);
      
      // For simplicity in this demo, we'll just simulate STT or use a browser API if available
      // Real implementation would send audio to Gemini 2.5 Flash Native Audio
    } catch (err) {
      console.error("Microphone access denied", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      // Here we would process the audio
      setInput("Simulated voice input: Tell me about photosynthesis.");
    }
  };

  const handleGenerateCourse = async () => {
    if (!courseTopic) return;
    setLoading(true);
    try {
      const data = await generateCourse(courseTopic, courseLevel);
      setCourseData(data);
      setActiveLessonIndex(0);
      setCompletedLessons([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleLessonCompletion = (id: number) => {
    setCompletedLessons(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const handleGenerateQuiz = async () => {
    if (!quizTopic) return;
    setLoading(true);
    const questions = await generateQuiz(quizTopic);
    setQuizQuestions(questions);
    setCurrentQuizIndex(0);
    setQuizScore(0);
    setQuizFinished(false);
    setLoading(false);
  };

  const handleGenerateExam = async () => {
    if (!examTopic) return;
    setLoading(true);
    const questions = await generateExam(examTopic);
    setExamQuestions(questions);
    setLoading(false);
  };

  const downloadExamPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`Exam: ${examTopic}`, 20, 20);
    doc.setFontSize(12);
    examQuestions.forEach((q, i) => {
      const y = 40 + (i % 10) * 25;
      if (i > 0 && i % 10 === 0) doc.addPage();
      doc.text(`${i + 1}. ${q.question}`, 20, y);
      q.options.forEach((opt, oi) => {
        doc.text(`   ${String.fromCharCode(65 + oi)}) ${opt}`, 20, y + 5 + oi * 5);
      });
    });
    doc.save(`${examTopic}_Exam.pdf`);
  };

  const handleGenerateDoc = async () => {
    if (!docTopic) return;
    setLoading(true);
    const slides = await generateDocSlides(docTopic);
    setDocSlides(slides);
    setLoading(false);
  };

  const handleGeneratePPT = async () => {
    if (!pptTopic) return;
    setLoading(true);
    const slides = await generatePPTSlides(pptTopic);
    setPptSlides(slides);
    setLoading(false);
  };

  const downloadPPT = () => {
    const pres = new pptxgen();
    pptSlides.forEach(slideData => {
      const slide = pres.addSlide();
      slide.addText(slideData.title, { x: 1, y: 1, w: '80%', fontSize: 32, bold: true, color: '363636' });
      slide.addText(slideData.bullets.join('\n'), { x: 1, y: 2, w: '80%', fontSize: 18, color: '666666' });
    });
    pres.writeFile({ fileName: `${pptTopic}_Presentation.pptx` });
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col p-6 gap-8">
        <div className="flex items-center gap-3 px-2">
          <div className="bg-indigo-600 p-2 rounded-xl text-white">
            <GraduationCap size={28} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">study 26</h1>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          <SidebarItem icon={MessageSquare} label="AI Chat" active={currentView === 'chat'} onClick={() => setCurrentView('chat')} />
          <SidebarItem icon={BookOpen} label="Course" active={currentView === 'course'} onClick={() => setCurrentView('course')} />
          <SidebarItem icon={CheckSquare} label="Quiz Mode" active={currentView === 'quiz'} onClick={() => setCurrentView('quiz')} />
          <SidebarItem icon={GraduationCap} label="Exam Mode" active={currentView === 'exam'} onClick={() => setCurrentView('exam')} />
          <SidebarItem icon={FileText} label="Doc" active={currentView === 'doc'} onClick={() => setCurrentView('doc')} />
          <SidebarItem icon={Presentation} label="PPT" active={currentView === 'ppt'} onClick={() => setCurrentView('ppt')} />
        </nav>

        <div className="pt-6 border-t border-slate-100">
          <div className="bg-indigo-50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">Pro Student</p>
            <p className="text-sm text-slate-600">Unlock all features with AI-powered learning.</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-white">
        <header className="h-16 border-b border-slate-100 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-slate-800 capitalize">
            {currentView.replace('-', ' ')}
          </h2>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <History size={20} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {/* --- Chat View --- */}
            {currentView === 'chat' && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-4xl mx-auto h-full flex flex-col"
              >
                <div className="flex-1 space-y-6 mb-8">
                  {chatHistory.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center py-20">
                      <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                        <MessageSquare size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">Welcome to study 26 Chat</h3>
                      <p className="text-slate-500 max-w-md">Ask me anything about your studies, upload documents for summary, or use voice to chat.</p>
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={cn("flex gap-4", msg.role === 'user' ? "flex-row-reverse" : "")}>
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        msg.role === 'user' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                      )}>
                        {msg.role === 'user' ? "U" : "AI"}
                      </div>
                      <div className={cn(
                        "max-w-[80%] rounded-2xl p-4 relative group",
                        msg.role === 'user' ? "bg-indigo-600 text-white rounded-tr-none" : "bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100"
                      )}>
                        <div className="prose prose-sm max-w-none prose-indigo">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                        <div className={cn(
                          "absolute top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                          msg.role === 'user' ? "-left-10" : "-right-10"
                        )}>
                          <ReadingButton text={msg.content} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Loader2 size={16} className="animate-spin text-indigo-600" />
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 italic text-slate-400 text-sm">
                        EduSpark is thinking...
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="sticky bottom-0 pb-4 bg-white">
                  <div className="relative group">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                      placeholder="Ask EduSpark anything..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 pr-32 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none min-h-[60px]"
                      rows={1}
                    />
                    <div className="absolute right-3 bottom-3 flex items-center gap-2">
                      <button 
                        onClick={isRecording ? stopRecording : startRecording}
                        className={cn(
                          "p-2 rounded-xl transition-colors",
                          isRecording ? "bg-red-500 text-white animate-pulse" : "text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                        )}
                      >
                        <Mic size={20} />
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
                        accept=".txt,.md,.js,.ts,.py,.json"
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-xl transition-colors"
                      >
                        <Paperclip size={20} />
                      </button>
                      <button 
                        onClick={handleSendMessage}
                        disabled={!input.trim() || loading}
                        className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-200"
                      >
                        <Send size={20} />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between mt-2 px-2">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">study 26 v1.0</p>
                    <button 
                      onClick={() => setChatHistory([])}
                      className="text-[10px] text-red-400 hover:text-red-600 uppercase font-bold tracking-widest flex items-center gap-1"
                    >
                      <Trash2 size={10} /> Clear History
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- Course Maker View --- */}
            {currentView === 'course' && (
              <motion.div 
                key="course"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-5xl mx-auto"
              >
                {!courseData ? (
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                    <div className="p-10 border-b border-slate-100 bg-indigo-600 text-white">
                      <h3 className="text-3xl font-bold mb-2">Create Your Course</h3>
                      <p className="text-indigo-100 mb-8">Enter a topic and study 26 will build a full learning path for you.</p>
                      
                      <div className="space-y-6">
                        <div>
                          <label className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-2 block">Topic</label>
                          <input 
                            type="text"
                            value={courseTopic}
                            onChange={(e) => setCourseTopic(e.target.value)}
                            placeholder="e.g. Quantum Physics, Modern History, Python Basics"
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
                            <button
                              key={level}
                              onClick={() => setCourseLevel(level)}
                              className={cn(
                                "py-3 rounded-xl font-bold text-sm transition-all border",
                                courseLevel === level 
                                  ? "bg-white text-indigo-600 border-white shadow-lg" 
                                  : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                              )}
                            >
                              {level}
                            </button>
                          ))}
                        </div>

                        <button 
                          onClick={handleGenerateCourse}
                          disabled={loading || !courseTopic}
                          className="w-full bg-indigo-500 text-white py-4 rounded-xl font-bold hover:bg-indigo-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-indigo-900/20"
                        >
                          {loading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                          Generate Course
                        </button>
                      </div>

                      <div className="mt-8">
                        <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-3">Suggested Topics</p>
                        <div className="flex flex-wrap gap-2">
                          {['Quantum Physics', 'Modern History', 'Python Basics', 'Artificial Intelligence', 'Sustainable Energy', 'Human Anatomy', 'Creative Writing', 'Financial Literacy'].map((topic) => (
                            <button
                              key={topic}
                              onClick={() => setCourseTopic(topic)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                                courseTopic === topic 
                                  ? "bg-white text-indigo-600 border-white shadow-md" 
                                  : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                              )}
                            >
                              {topic}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Course Sidebar */}
                    <div className="lg:col-span-1 space-y-6">
                      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-6">
                        <button 
                          onClick={() => setCourseData(null)}
                          className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-6 flex items-center gap-1 hover:gap-2 transition-all"
                        >
                          <ChevronRight size={14} className="rotate-180" /> Back to Creator
                        </button>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">{courseData.title}</h3>
                        <p className="text-sm text-slate-500 mb-6">{courseData.description}</p>
                        
                        <div className="space-y-2">
                          {courseData.lessons.map((lesson, i) => (
                            <button
                              key={lesson.id}
                              onClick={() => setActiveLessonIndex(i)}
                              className={cn(
                                "w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 group",
                                activeLessonIndex === i 
                                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                                  : "hover:bg-indigo-50 text-slate-600"
                              )}
                            >
                              <div className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                                activeLessonIndex === i 
                                  ? "bg-white/20 text-white" 
                                  : completedLessons.includes(lesson.id) ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"
                              )}>
                                {completedLessons.includes(lesson.id) ? "✓" : i + 1}
                              </div>
                              <span className="text-sm font-medium truncate">{lesson.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100">
                        <div className="flex justify-between items-end mb-4">
                          <div>
                            <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1">Your Progress</p>
                            <h4 className="text-2xl font-bold">{Math.round((completedLessons.length / courseData.lessons.length) * 100)}%</h4>
                          </div>
                          <GraduationCap size={32} className="text-indigo-400" />
                        </div>
                        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-white"
                            initial={{ width: 0 }}
                            animate={{ width: `${(completedLessons.length / courseData.lessons.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Lesson Content */}
                    <div className="lg:col-span-2">
                      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                          <div>
                            <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Lesson {activeLessonIndex + 1}</p>
                            <h4 className="text-2xl font-bold text-slate-800">{courseData.lessons[activeLessonIndex].title}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <ReadingButton text={courseData.lessons[activeLessonIndex].content} />
                            <button 
                              onClick={() => toggleLessonCompletion(courseData.lessons[activeLessonIndex].id)}
                              className={cn(
                                "px-4 py-2 rounded-xl text-sm font-bold transition-all border",
                                completedLessons.includes(courseData.lessons[activeLessonIndex].id)
                                  ? "bg-green-50 text-green-600 border-green-200"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-600 hover:text-indigo-600"
                              )}
                            >
                              {completedLessons.includes(courseData.lessons[activeLessonIndex].id) ? "Completed ✓" : "Mark as Done"}
                            </button>
                          </div>
                        </div>
                        
                        <div className="p-8 flex-1 prose prose-indigo max-w-none">
                          <ReactMarkdown>{courseData.lessons[activeLessonIndex].content}</ReactMarkdown>
                        </div>

                        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-between">
                          <button 
                            disabled={activeLessonIndex === 0}
                            onClick={() => setActiveLessonIndex(i => i - 1)}
                            className="px-6 py-2 rounded-xl text-sm font-bold text-slate-600 hover:text-indigo-600 disabled:opacity-30 transition-all flex items-center gap-2"
                          >
                            <ChevronRight size={16} className="rotate-180" /> Previous
                          </button>
                          <button 
                            disabled={activeLessonIndex === courseData.lessons.length - 1}
                            onClick={() => setActiveLessonIndex(i => i + 1)}
                            className="px-6 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-30 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
                          >
                            Next Lesson <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* --- Quiz Mode View --- */}
            {currentView === 'quiz' && (
              <motion.div 
                key="quiz"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-3xl mx-auto"
              >
                {!quizQuestions.length ? (
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-10 text-center">
                    <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <CheckSquare size={40} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">Test Your Knowledge</h3>
                    <p className="text-slate-500 mb-8">Generate a quick 5-question quiz on any subject to see how much you know.</p>
                    <div className="flex gap-3 max-w-md mx-auto">
                      <input 
                        type="text"
                        value={quizTopic}
                        onChange={(e) => setQuizTopic(e.target.value)}
                        placeholder="Enter topic..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      />
                      <button 
                        onClick={handleGenerateQuiz}
                        disabled={loading || !quizTopic}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : "Start Quiz"}
                      </button>
                    </div>
                  </div>
                ) : quizFinished ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl border border-slate-100 shadow-xl p-10 text-center"
                  >
                    <h3 className="text-3xl font-bold text-slate-800 mb-2">Quiz Complete!</h3>
                    <p className="text-slate-500 mb-8">You scored {quizScore} out of {quizQuestions.length}</p>
                    <div className="text-6xl font-black text-indigo-600 mb-10">
                      {Math.round((quizScore / quizQuestions.length) * 100)}%
                    </div>
                    <button 
                      onClick={() => setQuizQuestions([])}
                      className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all"
                    >
                      Try Another Topic
                    </button>
                  </motion.div>
                ) : (
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                    <div className="h-2 bg-slate-100">
                      <motion.div 
                        className="h-full bg-indigo-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentQuizIndex + 1) / quizQuestions.length) * 100}%` }}
                      />
                    </div>
                    <div className="p-10">
                      <div className="flex justify-between items-center mb-8">
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Question {currentQuizIndex + 1} of {quizQuestions.length}</span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Score: {quizScore}</span>
                      </div>
                      <h4 className="text-xl font-bold text-slate-800 mb-8">{quizQuestions[currentQuizIndex].question}</h4>
                      <div className="grid gap-4">
                        {quizQuestions[currentQuizIndex].options.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              if (i === quizQuestions[currentQuizIndex].correctAnswer) setQuizScore(s => s + 1);
                              if (currentQuizIndex < quizQuestions.length - 1) {
                                setCurrentQuizIndex(i => i + 1);
                              } else {
                                setQuizFinished(true);
                              }
                            }}
                            className="w-full text-left px-6 py-4 rounded-2xl border border-slate-200 hover:border-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-between group"
                          >
                            <span className="font-medium text-slate-700 group-hover:text-indigo-700">{opt}</span>
                            <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-600" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* --- Exam Mode View --- */}
            {currentView === 'exam' && (
              <motion.div 
                key="exam"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto"
              >
                <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-10">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                      <GraduationCap size={28} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-800">Exam Generator</h3>
                      <p className="text-slate-500">Create a professional 40-question exam for deep assessment.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 mb-10">
                    <input 
                      type="text"
                      value={examTopic}
                      onChange={(e) => setExamTopic(e.target.value)}
                      placeholder="Enter exam subject..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                    <button 
                      onClick={handleGenerateExam}
                      disabled={loading || !examTopic}
                      className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : "Generate Exam"}
                    </button>
                  </div>

                  {examQuestions.length > 0 && (
                    <div className="border-t border-slate-100 pt-8 animate-in fade-in duration-500">
                      <div className="flex justify-between items-center mb-6">
                        <h4 className="font-bold text-slate-800">Generated Exam: {examTopic}</h4>
                        <button 
                          onClick={downloadExamPDF}
                          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition-all"
                        >
                          <Download size={16} /> Download PDF
                        </button>
                      </div>
                      <div className="space-y-6 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                        {examQuestions.map((q, i) => (
                          <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="font-bold text-slate-700 mb-3">{i + 1}. {q.question}</p>
                            <div className="grid grid-cols-2 gap-2">
                              {q.options.map((opt, oi) => (
                                <div key={oi} className="text-sm text-slate-500 flex gap-2">
                                  <span className="font-bold text-indigo-600">{String.fromCharCode(65 + oi)}.</span>
                                  {opt}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* --- Doc Maker View --- */}
            {currentView === 'doc' && (
              <motion.div 
                key="doc"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-4xl mx-auto"
              >
                <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                  <div className="p-10 bg-slate-900 text-white">
                    <h3 className="text-2xl font-bold mb-2">Document Architect</h3>
                    <p className="text-slate-400 mb-6">Generate a structured 5-section educational document.</p>
                    <div className="flex gap-3">
                      <input 
                        type="text"
                        value={docTopic}
                        onChange={(e) => setDocTopic(e.target.value)}
                        placeholder="Document topic..."
                        className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
                      />
                      <button 
                        onClick={handleGenerateDoc}
                        disabled={loading || !docTopic}
                        className="bg-white text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-slate-100 transition-all disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : "Create Doc"}
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-10 space-y-12">
                    {docSlides.length > 0 ? (
                      docSlides.map((slide, i) => (
                        <div key={i} className="relative pl-8 border-l-2 border-indigo-100">
                          <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white" />
                          <h4 className="text-xl font-bold text-slate-800 mb-4">{slide.title}</h4>
                          <div className="prose prose-slate max-w-none">
                            <ReactMarkdown>{slide.content}</ReactMarkdown>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center opacity-30">
                        <FileText size={64} className="mx-auto mb-4" />
                        <p>Your structured document will be generated here.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- PPT Maker View --- */}
            {currentView === 'ppt' && (
              <motion.div 
                key="ppt"
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-4xl mx-auto"
              >
                <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-10">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center">
                      <Presentation size={28} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-800">Presentation Designer</h3>
                      <p className="text-slate-500">Create a 5-slide PowerPoint outline and download the file.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 mb-10">
                    <input 
                      type="text"
                      value={pptTopic}
                      onChange={(e) => setPptTopic(e.target.value)}
                      placeholder="Presentation topic..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                    />
                    <button 
                      onClick={handleGeneratePPT}
                      disabled={loading || !pptTopic}
                      className="bg-orange-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-orange-700 transition-all disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : "Generate Slides"}
                    </button>
                  </div>

                  {pptSlides.length > 0 && (
                    <div className="space-y-8">
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-slate-800">Slide Preview</h4>
                        <button 
                          onClick={downloadPPT}
                          className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-100"
                        >
                          <Download size={16} /> Download .pptx
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {pptSlides.map((slide, i) => (
                          <div key={i} className="aspect-video bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-[10px] font-bold text-orange-600 uppercase mb-2">Slide {i + 1}</div>
                            <h5 className="font-bold text-slate-800 mb-3 text-lg line-clamp-1">{slide.title}</h5>
                            <ul className="space-y-2">
                              {slide.bullets.map((b, bi) => (
                                <li key={bi} className="text-xs text-slate-500 flex gap-2">
                                  <span className="text-orange-400">•</span> {b}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
