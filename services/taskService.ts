import { firestore } from './firebase';
import type { Task, TaskPriority } from '../types';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const getTasksCollection = (userId: string) => 
    firestore.collection('users').doc(userId).collection('tasks');

export const addTask = async (userId: string, taskData: Omit<Task, 'id' | 'createdAt' | 'isCompleted'>): Promise<void> => {
    try {
        await getTasksCollection(userId).add({
            ...taskData,
            isCompleted: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error("Error adding task:", error);
        throw new Error("Failed to add task to the database.");
    }
};

export const onTasksSnapshot = (
    userId: string, 
    callback: (tasks: Task[]) => void,
    onError: (error: Error) => void
): (() => void) => {
    const query = getTasksCollection(userId).orderBy('dueDate', 'asc');

    return query.onSnapshot(
        (querySnapshot) => {
            const tasks = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
            } as Task));

            // Client-side sort to bring pending tasks (isCompleted: false) to the top.
            tasks.sort((a, b) => {
                if (a.isCompleted !== b.isCompleted) {
                    return a.isCompleted ? 1 : -1; // false comes before true
                }
                return 0; // Keep the original 'dueDate' sort order for items with the same completion status
            });

            callback(tasks);
        },
        (error) => {
            console.error("Error fetching real-time tasks:", error);
            onError(new Error("Failed to fetch tasks."));
        }
    );
};

export const updateTask = async (userId: string, taskId: string, dataToUpdate: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<void> => {
    try {
        await getTasksCollection(userId).doc(taskId).update(dataToUpdate);
    } catch (error) {
        console.error("Error updating task:", error);
        throw new Error("Failed to update task.");
    }
};

export const deleteTask = async (userId: string, taskId: string): Promise<void> => {
    try {
        await getTasksCollection(userId).doc(taskId).delete();
    } catch (error) {
        console.error("Error deleting task:", error);
        throw new Error("Failed to delete the task.");
    }
};
