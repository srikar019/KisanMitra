import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Task, TaskPriority, ActiveView } from '../types';
import { addTask, onTasksSnapshot, updateTask, deleteTask } from '../services/taskService';
import Card from './common/Card';
import Icon from './common/Icon';
import Button from './common/Button';
import Spinner from './common/Spinner';

const TaskReminders: React.FC = () => {
    const { currentUser } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const [errorTasks, setErrorTasks] = useState<string | null>(null);

    const initialTaskState = { description: '', dueDate: new Date().toISOString().split('T')[0], priority: TaskPriority.Medium };
    const [newTask, setNewTask] = useState(initialTaskState);

    useEffect(() => {
        if (!currentUser) return;
        setLoadingTasks(true);
        const unsub = onTasksSnapshot(currentUser.uid, (fetchedTasks) => {
            setTasks(fetchedTasks);
            setLoadingTasks(false);
        }, (err) => {
            setErrorTasks(err.message);
            setLoadingTasks(false);
        });
        return () => unsub();
    }, [currentUser]);

    const handleTaskChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => 
        setNewTask(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !newTask.description.trim()) {
            setErrorTasks("Please enter a description.");
            return;
        }
        setErrorTasks(null);
        try {
            await addTask(currentUser.uid, newTask);
            setNewTask(initialTaskState);
        } catch (error) {
            setErrorTasks(error instanceof Error ? error.message : "Could not add task.");
        }
    };

    const handleToggleTask = async (task: Task) => {
        if (!currentUser) return;
        try {
            await updateTask(currentUser.uid, task.id, { isCompleted: !task.isCompleted });
        } catch (error) {
            setErrorTasks(error instanceof Error ? error.message : "Could not update task.");
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!currentUser) return;
        try {
            await deleteTask(currentUser.uid, taskId);
        } catch (error) {
            setErrorTasks(error instanceof Error ? error.message : "Could not delete task.");
        }
    };

    const priorityClasses: { [key in TaskPriority]: string } = {
        [TaskPriority.High]: 'bg-red-100 text-red-800',
        [TaskPriority.Medium]: 'bg-yellow-100 text-yellow-800',
        [TaskPriority.Low]: 'bg-green-100 text-green-800'
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleAddTask} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2">
                    <label className="text-sm font-medium">New Task</label>
                    <input type="text" name="description" value={newTask.description} onChange={handleTaskChange} placeholder="e.g., Check irrigation pump" className="w-full mt-1 p-2 border rounded-md focus:ring-green-500 focus:border-green-500" required />
                </div>
                <div>
                    <label className="text-sm font-medium">Due Date</label>
                    <input type="date" name="dueDate" value={newTask.dueDate} onChange={handleTaskChange} className="w-full mt-1 p-2 border rounded-md focus:ring-green-500 focus:border-green-500" required />
                </div>
                <div className="flex items-end gap-2">
                    <div className="flex-grow">
                        <label className="text-sm font-medium">Priority</label>
                        <select name="priority" value={newTask.priority} onChange={handleTaskChange} className="w-full mt-1 p-2 border rounded-md focus:ring-green-500 focus:border-green-500">
                            {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <Button type="submit" className="!px-3 !py-2">+</Button>
                </div>
            </form>
            {errorTasks && <p className="text-red-500 text-center text-sm">{errorTasks}</p>}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {loadingTasks ? <div className="text-center py-4"><Spinner /></div> : tasks.length === 0 ? <p className="text-gray-500 text-center py-4">No tasks yet.</p> : (
                    tasks.map(task => (
                        <div key={task.id} className={`flex items-center gap-3 p-3 rounded-xl transition-all border ${task.isCompleted ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200 shadow-sm'}`}>
                            <input type="checkbox" checked={task.isCompleted} onChange={() => handleToggleTask(task)} className="h-5 w-5 rounded text-green-600 focus:ring-green-500 border-gray-300" />
                            <div className="flex-grow">
                                <p className={`text-sm font-semibold ${task.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.description}</p>
                                <p className={`text-xs ${task.isCompleted ? 'text-gray-300' : 'text-gray-500'}`}>Due: {task.dueDate}</p>
                            </div>
                            <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full ${priorityClasses[task.priority]}`}>{task.priority}</span>
                            <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors">
                                <Icon name="trash" className="h-4 w-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const MyFarmPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [isTasksOpen, setIsTasksOpen] = useState(true);
    const [isIrrigationOpen, setIsIrrigationOpen] = useState(true);
    
    const [tasks, setTasks] = useState<Task[]>([]);
    useEffect(() => {
        if (!currentUser) return;
        const unsub = onTasksSnapshot(currentUser.uid, setTasks, () => {});
        return () => unsub();
    }, [currentUser]);

    const pendingTasksCount = useMemo(() => tasks.filter(t => !t.isCompleted).length, [tasks]);

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            {/* Task Reminders Section */}
            <Card className="!p-0 overflow-hidden border border-gray-100 shadow-sm">
                <header 
                    onClick={() => setIsTasksOpen(!isTasksOpen)} 
                    className="flex justify-between items-center p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-lg">
                            <Icon name="clipboard-list" className="h-6 w-6 text-green-700" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">Daily Farm Tasks</h3>
                        {pendingTasksCount > 0 && (
                            <span className="flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-black text-white bg-red-500 rounded-full shadow-lg shadow-red-500/20">
                                {pendingTasksCount}
                            </span>
                        )}
                    </div>
                    <Icon name="chevron-down" className={`h-6 w-6 text-gray-400 transition-transform duration-300 ${isTasksOpen ? 'rotate-180' : ''}`} />
                </header>
                <AnimatePresence>
                    {isTasksOpen && (
                        <motion.section 
                            initial={{ height: 0, opacity: 0 }} 
                            animate={{ height: 'auto', opacity: 1 }} 
                            exit={{ height: 0, opacity: 0 }} 
                            transition={{ duration: 0.3, ease: 'easeInOut' }} 
                            className="overflow-hidden"
                        >
                            <div className="p-6 pt-2 border-t border-gray-100">
                                <TaskReminders />
                            </div>
                        </motion.section>
                    )}
                </AnimatePresence>
            </Card>

            {/* Smart Irrigation Hub - Now Collapsible with Dropdown Button */}
            <Card className="!p-0 overflow-hidden relative border border-blue-100 shadow-xl shadow-blue-500/5">
                <header 
                    onClick={() => setIsIrrigationOpen(!isIrrigationOpen)} 
                    className="p-5 border-b border-gray-100 bg-white flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors relative z-10"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-2 rounded-lg">
                            <Icon name="sparkles" className="h-6 w-6 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">Smart Irrigation Hub</h3>
                    </div>
                    <Icon name="chevron-down" className={`h-6 w-6 text-gray-400 transition-transform duration-300 ${isIrrigationOpen ? 'rotate-180' : ''}`} />
                </header>
                
                <AnimatePresence>
                    {isIrrigationOpen && (
                        <motion.section 
                            initial={{ height: 0, opacity: 0 }} 
                            animate={{ height: 'auto', opacity: 1 }} 
                            exit={{ height: 0, opacity: 0 }} 
                            transition={{ duration: 0.3, ease: 'easeInOut' }} 
                            className="overflow-hidden"
                        >
                            <div className="relative h-[500px] flex items-center justify-center p-6 bg-gray-50/40">
                                {/* Visual Decor */}
                                <div className="absolute top-10 left-10 w-32 h-32 bg-blue-400/5 rounded-full blur-3xl"></div>
                                <div className="absolute bottom-10 right-10 w-48 h-48 bg-cyan-400/5 rounded-full blur-3xl"></div>

                                {/* COMING SOON MODAL - AS REQUESTED */}
                                <div className="bg-white rounded-[3.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.12)] border border-gray-100 text-center max-w-sm w-full py-16 px-10 flex flex-col items-center animate-fade-in-up">
                                    {/* Sparkle Icon Container */}
                                    <div className="size-24 bg-blue-500 rounded-full flex items-center justify-center text-white mb-8 shadow-2xl shadow-blue-500/30">
                                        <Icon name="sparkles" className="h-12 w-12" />
                                    </div>
                                    
                                    <h3 className="text-3xl font-black text-slate-800 mb-4 tracking-tighter uppercase">SMART HYDRATION</h3>
                                    
                                    <div className="inline-block px-6 py-2 bg-blue-50 text-blue-600 text-[11px] font-black rounded-full uppercase tracking-widest mb-8 border border-blue-100">
                                        Phase 2 Development
                                    </div>
                                    
                                    <p className="text-slate-500 text-sm leading-relaxed mb-10 px-2 font-medium">
                                        Our engineers are integrating real-time IoT sensors and satellite moisture mapping. Soon you'll be able to manage your entire farm's water cycle with surgical AI precision.
                                    </p>
                                    
                                    <div className="flex gap-4">
                                        <div className="px-6 py-2.5 bg-slate-50 text-slate-400 text-[10px] font-black rounded-full border border-slate-100 uppercase tracking-tighter shadow-sm">
                                            IOT CORE
                                        </div>
                                        <div className="px-6 py-2.5 bg-slate-50 text-slate-400 text-[10px] font-black rounded-full border border-slate-100 uppercase tracking-tighter shadow-sm">
                                            SATELLITE SYNC
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.section>
                    )}
                </AnimatePresence>
            </Card>
        </div>
    );
};

export default MyFarmPage;
