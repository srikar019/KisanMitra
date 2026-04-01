import { firestore } from './firebase';
import type { CommunityFeedPost, SharedContent, ContentType, NewsArticle } from '../types';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

export const postToFeed = async (senderUid: string, senderName: string, senderEmail: string, content: SharedContent, contentType: ContentType, userComment?: string): Promise<void> => {
    try {
        const feedCollection = firestore.collection('community_feed');

        // Firestore cannot serialize `undefined` values. This cleans the object.
        const cleanContent = JSON.parse(JSON.stringify(content));

        // Create a unique identifier for the content. Use URL for news, name otherwise.
        const contentIdentifier = (content as NewsArticle).url || ('name' in content ? content.name : (content as NewsArticle).title);

        if (!contentIdentifier) {
            throw new Error("Cannot share item without a unique identifier (title, name, or url).");
        }

        // Check for duplicates from the same user
        const q = feedCollection
            .where('senderUid', '==', senderUid)
            .where('contentIdentifier', '==', contentIdentifier);

        const querySnapshot = await q.get();

        if (!querySnapshot.empty) {
            throw new Error("You have already shared this item.");
        }

        await feedCollection.add({
            senderUid,
            senderName,
            senderEmail,
            content: cleanContent,
            contentType,
            contentIdentifier, // Store the identifier
            userComment: userComment || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error("Error posting to feed:", error);
        // Re-throw the original error or a new one to be handled by the UI
        if (error instanceof Error && (error.message.includes("already shared") || error.message.includes("without a unique identifier"))) {
            throw error;
        }
        throw new Error("Failed to share to the community feed.");
    }
};

export const onFeedSnapshot = (
    callback: (posts: CommunityFeedPost[]) => void,
    onError: (error: Error) => void
): (() => void) => {
    const feedCollection = firestore.collection('community_feed');
    const query = feedCollection.orderBy('createdAt', 'desc').limit(50); // Limit to recent posts

    return query.onSnapshot(
        (querySnapshot) => {
            const posts = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
            } as CommunityFeedPost));
            callback(posts);
        },
        (error) => {
            console.error("Error fetching community feed:", error);
            onError(new Error("Failed to fetch the community feed."));
        }
    );
};

export const deleteFeedPost = async (postId: string, userId: string): Promise<void> => {
    const postRef = firestore.collection('community_feed').doc(postId);
    try {
        await firestore.runTransaction(async (transaction) => {
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists) {
                throw new Error("Post does not exist.");
            }
            const postData = postDoc.data() as CommunityFeedPost;
            if (postData.senderUid !== userId) {
                throw new Error("You are not authorized to delete this post.");
            }
            transaction.delete(postRef);
        });
    } catch (error) {
        console.error("Error deleting feed post:", error);
        throw error; // Re-throw to be handled by UI
    }
};

export const updateFeedPostComment = async (postId: string, userId: string, newComment: string): Promise<void> => {
    const postRef = firestore.collection('community_feed').doc(postId);
    try {
        await firestore.runTransaction(async (transaction) => {
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists) {
                throw new Error("Post does not exist.");
            }
            const postData = postDoc.data() as CommunityFeedPost;
            if (postData.senderUid !== userId) {
                throw new Error("You are not authorized to edit this post.");
            }
            transaction.update(postRef, { userComment: newComment });
        });
    } catch (error) {
        console.error("Error updating feed post comment:", error);
        throw error; // Re-throw to be handled by UI
    }
};
