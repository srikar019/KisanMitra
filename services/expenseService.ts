import { firestore } from './firebase';
import type { Expense } from '../types';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

/**
 * Adds a new expense document to a user's expenses subcollection.
 * @param userId The UID of the user.
 * @param expenseData The expense data to add (without the id).
 */
export const addExpense = async (userId: string, expenseData: Omit<Expense, 'id'>): Promise<void> => {
    try {
        const expensesCollection = firestore.collection('users').doc(userId).collection('expenses');
        await expensesCollection.add({
            ...expenseData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error("Error adding expense:", error);
        throw new Error("Failed to add expense to the database.");
    }
};

/**
 * Sets up a real-time listener for a user's expenses.
 * @param userId The UID of the user.
 * @param callback The function to call with the updated expenses list.
 * @param onError The function to call when an error occurs.
 * @returns An unsubscribe function to detach the listener.
 */
export const onExpensesSnapshot = (
    userId: string, 
    callback: (expenses: Expense[]) => void,
    onError: (error: Error) => void
): (() => void) => {
    const expensesCollection = firestore.collection('users').doc(userId).collection('expenses');
    const query = expensesCollection.orderBy('date', 'desc');

    return query.onSnapshot(
        (querySnapshot) => {
            const expenses = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            } as Expense));
            callback(expenses);
        },
        (error) => {
            console.error("Error fetching real-time expenses:", error);
            onError(new Error("Failed to fetch expenses."));
        }
    );
};

/**
 * Deletes an expense document from a user's expenses subcollection.
 * @param userId The UID of the user.
 * @param expenseId The ID of the expense document to delete.
 */
export const deleteExpense = async (userId: string, expenseId: string): Promise<void> => {
    try {
        const expenseDocRef = firestore.collection('users').doc(userId).collection('expenses').doc(expenseId);
        await expenseDocRef.delete();
    } catch (error) {
        console.error("Error deleting expense:", error);
        throw new Error("Failed to delete the expense.");
    }
};
