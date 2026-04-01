import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAllFarmers } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { sendConnectionRequest, onConnectionsSnapshot, updateConnectionRequestStatus, onPendingRequestsSnapshot, removeConnection } from '../services/connectionService';
import { onFeedSnapshot, deleteFeedPost, updateFeedPostComment } from '../services/communityFeedService';
import type { FarmerProfile, ConnectionRequest, CommunityFeedPost, NewsArticle, GovernmentScheme, Incentive, SharedContent } from '../types';
import Card from './common/Card';
import Icon from './common/Icon';
import Button from './common/Button';
import { firestore } from '../services/firebase';
import Modal from './common/Modal';
import Spinner from './common/Spinner';
import { useLanguage } from '../contexts/LanguageContext';
import SafeHTML from './common/SafeHTML';

type CommunityTab = 'Community Feed' | 'Find Farmers' | 'My Connections' | 'Requests';

interface CommunityPageProps {
    onStartChat: (recipient: FarmerProfile) => void;
}

const normalizeUrl = (url: string | undefined): string => {
    if (!url) return '#';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
        return url;
    }
    return `https://${url}`;
};

const SharedItemDisplay: React.FC<{ post: CommunityFeedPost }> = ({ post }) => {
    const { translate } = useLanguage();
    const { content, contentType } = post;
    switch (contentType) {
        case 'news': {
            const item = content as NewsArticle;
            return (
                <div className="p-4 border-t">
                    <p className="text-xs text-gray-500 uppercase font-semibold">{translate('community.shared.news')}</p>
                    <a href={normalizeUrl(item.url)} target="_blank" rel="noopener noreferrer" className="text-lg font-bold text-green-700 hover:underline">{item.title}</a>
                    <p className="text-sm text-gray-600 font-bold mt-1">{item.source} - {item.publishedDate}</p>
                    <p className="text-gray-600 mt-2 text-sm">{item.summary}</p>
                </div>
            );
        }
        case 'scheme': {
            const item = content as GovernmentScheme;
            return (
                <div className="p-4 border-t">
                    <p className="text-xs text-gray-500 uppercase font-semibold">{translate('community.shared.scheme')}</p>
                    <h4 className="text-lg font-bold text-gray-800">{item.name}</h4>
                    <p className="text-gray-600 mt-2 text-sm">{item.description}</p>
                    <a href={normalizeUrl(item.officialLink)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold text-sm mt-2 inline-block">{translate('community.shared.officialLink')}</a>
                </div>
            );
        }
        case 'incentive': {
            const item = content as Incentive;
            return (
                <div className="p-4 border-t">
                     <p className="text-xs text-gray-500 uppercase font-semibold">{translate('community.shared.incentive')}</p>
                    <h4 className="text-lg font-bold text-gray-800">{item.name}</h4>
                    <p className="text-gray-600 mt-2 text-sm">{item.description}</p>
                     <a href={normalizeUrl(item.link)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold text-sm mt-2 inline-block">{translate('community.shared.learnMore')}</a>
                </div>
            );
        }
        default:
            return null;
    }
};

const PostActions: React.FC<{ onEdit: () => void; onDelete: () => void }> = ({ onEdit, onDelete }) => {
    const { translate } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-full hover:bg-gray-200" aria-label="Post options">
                <Icon name="ellipsis-vertical" className="h-5 w-5 text-gray-500" />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg border z-10 animate-fade-in-up">
                    <button onClick={() => { onEdit(); setIsOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{translate('community.post.button.edit')}</button>
                    <button onClick={() => { onDelete(); setIsOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">{translate('community.post.button.delete')}</button>
                </div>
            )}
        </div>
    );
};

const tabKeyMap: Record<CommunityTab, string> = {
    'Community Feed': 'community.tab.feed',
    'Find Farmers': 'community.tab.find',
    'My Connections': 'community.tab.connections',
    'Requests': 'community.tab.requests'
};

const CommunityPage: React.FC<CommunityPageProps> = ({ onStartChat }) => {
    const { currentUser, userProfile } = useAuth();
    const { translate } = useLanguage();
    const [activeTab, setActiveTab] = useState<CommunityTab>('Community Feed');
    
    // Data states
    const [allFarmers, setAllFarmers] = useState<FarmerProfile[]>([]);
    const [connections, setConnections] = useState<FarmerProfile[]>([]);
    const [sentRequests, setSentRequests] = useState<ConnectionRequest[]>([]);
    const [receivedRequests, setReceivedRequests] = useState<ConnectionRequest[]>([]);
    const [feedPosts, setFeedPosts] = useState<CommunityFeedPost[]>([]);

    // UI states
    const [loading, setLoading] = useState<boolean>(true);
    const [feedLoading, setFeedLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [postForAction, setPostForAction] = useState<CommunityFeedPost | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editComment, setEditComment] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Connection removal state
    const [connectionToRemove, setConnectionToRemove] = useState<FarmerProfile | null>(null);
    const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
    const [removeLoading, setRemoveLoading] = useState(false);

    
    const { pendingRequests: incomingRequestsFromContext } = useNotifications();

    useEffect(() => {
        const fetchAllUsers = async () => {
            setLoading(true);
            setError(null);
            try {
                const farmerList = await getAllFarmers();
                setAllFarmers(farmerList);
            } catch (err) {
                 setError(err instanceof Error ? err.message : translate('community.error.loadDirectory'));
            } finally {
                setLoading(false);
            }
        };
        fetchAllUsers();
    }, [translate]);
    
    useEffect(() => {
        if (!currentUser) return;

        const unsubConnections = onConnectionsSnapshot(currentUser.uid, setConnections);
        const unsubReceived = onPendingRequestsSnapshot(currentUser.uid, setReceivedRequests);
        const unsubFeed = onFeedSnapshot((posts) => {
            setFeedPosts(posts);
            setFeedLoading(false);
        }, (err) => {
            setError(err.message);
            setFeedLoading(false);
        });

        const unsubSent = firestore.collection('connections')
            .where('senderUid', '==', currentUser.uid)
            .where('status', '==', 'pending')
            .onSnapshot(snapshot => {
                const sent = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConnectionRequest));
                setSentRequests(sent);
            });

        return () => {
            unsubConnections();
            unsubReceived();
            unsubSent();
            unsubFeed();
        };
    }, [currentUser]);


    const farmerStatusMap = useMemo(() => {
        const statusMap = new Map<string, { status: string, requestId?: string }>();
        if (!currentUser) return statusMap;

        connections.forEach(c => statusMap.set(c.uid, { status: 'connected' }));
        sentRequests.forEach(r => statusMap.set(r.recipientUid, { status: 'sent' }));
        receivedRequests.forEach(r => statusMap.set(r.senderUid, { status: 'received', requestId: r.id }));
        
        return statusMap;
    }, [connections, sentRequests, receivedRequests, currentUser]);

    const handleAction = async (requestId: string, action: 'accepted' | 'rejected') => {
        try {
            await updateConnectionRequestStatus(requestId, action);
        } catch (error) {
            console.error(`Failed to ${action} request:`, error);
            setError(translate('community.error.action', { action }));
        }
    };

    const handleSendRequest = async (recipient: FarmerProfile) => {
         if (!currentUser || !userProfile) return;
         try {
            await sendConnectionRequest(userProfile, recipient);
         } catch(err) {
            setError(err instanceof Error ? err.message : translate('community.error.sendRequest'));
         }
    };
    
    const handleOpenEdit = (post: CommunityFeedPost) => {
        setPostForAction(post);
        setEditComment(post.userComment || '');
        setIsEditModalOpen(true);
    };

    const handleOpenDelete = (post: CommunityFeedPost) => {
        setPostForAction(post);
        setIsDeleteModalOpen(true);
    };
    
    const handleConfirmDelete = async () => {
        if (!postForAction || !currentUser) return;
        setActionLoading(true);
        setError(null);
        try {
            await deleteFeedPost(postForAction.id, currentUser.uid);
            setIsDeleteModalOpen(false);
            setPostForAction(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete post.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleConfirmEdit = async () => {
        if (!postForAction || !currentUser) return;
        setActionLoading(true);
        setError(null);
        try {
            await updateFeedPostComment(postForAction.id, currentUser.uid, editComment);
            setIsEditModalOpen(false);
            setPostForAction(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update comment.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenRemove = (farmer: FarmerProfile) => {
        setConnectionToRemove(farmer);
        setIsRemoveModalOpen(true);
    };

    const handleConfirmRemove = async () => {
        if (!connectionToRemove || !currentUser) return;
        setRemoveLoading(true);
        setError(null);
        try {
            await removeConnection(currentUser.uid, connectionToRemove.uid);
            setIsRemoveModalOpen(false);
            setConnectionToRemove(null);
        } catch (err) {
             setError(err instanceof Error ? err.message : "Failed to remove connection.");
        } finally {
            setRemoveLoading(false);
        }
    };


    const renderTabs = () => (
        <div className="flex border-b mb-6">
            {(['Community Feed', 'Find Farmers', 'My Connections', 'Requests'] as CommunityTab[]).map(tabKey => {
                const tabLabel = translate(tabKeyMap[tabKey]);
                return (
                    <button
                        key={tabKey}
                        onClick={() => setActiveTab(tabKey)}
                        className={`px-4 py-2 text-sm font-semibold relative ${activeTab === tabKey ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {tabLabel}
                        {tabKey === 'Requests' && incomingRequestsFromContext.length > 0 && (
                            <span className="absolute top-1 right-1 block h-4 w-4 text-xs rounded-full bg-red-500 text-white">
                                {incomingRequestsFromContext.length}
                            </span>
                        )}
                    </button>
                )
            })}
        </div>
    );
    
    const renderContent = () => {
        const hasSearch = searchTerm.trim().length > 0;

        // Updated filter logic: exclusively search by username (name).
        // Emails and Gmail addresses are now ignored in the filter logic.
        const filteredFarmers = !hasSearch ? [] : allFarmers.filter(f => {
            if (f.uid === currentUser?.uid) return false;
            
            const searchLower = searchTerm.toLowerCase();
            const displayName = (f.name || '').toLowerCase();
            
            // Only return farmers whose actual name (username) matches the search query.
            return displayName.length > 0 && displayName.includes(searchLower);
        });

        switch (activeTab) {
            case 'Community Feed':
                 return (
                    <div className="space-y-4">
                        {feedPosts.length === 0 ? (
                            <div className="text-center py-16 bg-gray-50 rounded-lg border">
                                <Icon name="users" className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-gray-700">{translate('community.feed.empty.title')}</h3>
                                <p className="text-gray-500 mt-2">{translate('community.feed.empty.subtitle')}</p>
                            </div>
                        ) : (
                            feedPosts.map(post => (
                                <div key={post.id} className="bg-white rounded-lg border animate-fade-in">
                                    <div className="p-4 flex justify-between items-start">
                                        <div>
                                            <p className="text-sm">
                                                <span className="font-semibold text-gray-800">{post.senderName}</span>
                                                <span className="text-gray-500"> {translate('community.post.shared')}</span>
                                            </p>
                                            <p className="text-xs text-gray-400">
                                            {post.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                            </p>
                                        </div>
                                        {currentUser?.uid === post.senderUid && (
                                            <PostActions
                                                onEdit={() => handleOpenEdit(post)}
                                                onDelete={() => handleOpenDelete(post)}
                                            />
                                        )}
                                    </div>
                                    {post.userComment && (
                                        <p className="px-4 pb-2 italic text-gray-700 border-b">"{post.userComment}"</p>
                                    )}
                                    <SharedItemDisplay post={post} />
                                </div>
                            ))
                        )}
                    </div>
                );
            case 'Find Farmers':
                return (
                     <div className="space-y-3">
                        {!hasSearch ? (
                            <div className="text-center py-12 text-gray-500">
                                <Icon name="search" className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                <p>{translate('community.find.emptyPrompt')}</p>
                            </div>
                        ) : filteredFarmers.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">No farmers found with username matching "{searchTerm}"</p>
                        ) : (
                            filteredFarmers.map(farmer => {
                                const { status } = farmerStatusMap.get(farmer.uid) || {};
                                return (
                                    <div key={farmer.uid} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
                                        <div>
                                            <p className="font-semibold text-gray-800">
                                                {farmer.name}
                                            </p>
                                            <p className="text-xs text-gray-500">{farmer.email}</p>
                                        </div>
                                        {status === 'connected' && <span className="text-sm text-green-600 font-semibold">{translate('community.find.status.connected')}</span>}
                                        {status === 'sent' && <span className="text-sm text-gray-500">{translate('community.find.status.sent')}</span>}
                                        {status === 'received' && <Button variant="secondary" className="!py-1 !px-4 !text-sm" onClick={() => setActiveTab('Requests')}>{translate('community.find.status.viewRequest')}</Button>}
                                        {!status && <Button className="!py-1 !px-4 !text-sm" onClick={() => handleSendRequest(farmer)}>{translate('community.find.button.connect')}</Button>}
                                    </div>
                                )
                            })
                        )}
                    </div>
                );
            case 'My Connections':
                return (
                     <div className="space-y-3">
                        {connections.length > 0 ? connections.map(conn => (
                            <div key={conn.uid} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
                                <div>
                                    <p className="font-semibold text-gray-800">
                                        {conn.name || conn.email.split('@')[0]}
                                    </p>
                                    <p className="text-xs text-gray-500">{conn.email}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="secondary" className="!py-1 !px-4 !text-sm" onClick={() => onStartChat(conn)}>{translate('community.connections.button.chat')}</Button>
                                    <button 
                                        onClick={() => handleOpenRemove(conn)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                        title={translate('community.connections.button.remove')}
                                    >
                                        <Icon name="trash" className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        )) : <p className="text-center text-gray-500 py-8">{translate('community.connections.empty')}</p>}
                    </div>
                );
            case 'Requests':
                return (
                     <div className="space-y-3">
                        {receivedRequests.length > 0 ? receivedRequests.map(req => (
                             <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
                                <div>
                                    <p className="font-semibold text-gray-800">{req.senderEmail.split('@')[0]}</p>
                                    <p className="text-sm text-gray-500">{req.senderEmail}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button className="!py-1 !px-4 !text-sm" onClick={() => handleAction(req.id, 'accepted')}>{translate('community.requests.button.accept')}</Button>
                                    <Button variant="secondary" className="!py-1 !px-4 !text-sm" onClick={() => handleAction(req.id, 'rejected')}>{translate('community.requests.button.reject')}</Button>
                                </div>
                            </div>
                        )) : <p className="text-center text-gray-500 py-8">{translate('community.requests.empty')}</p>}
                    </div>
                );
        }
    }

    return (
        <Card className="!max-w-4xl">
            {/* Post Edit Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={translate('community.post.editTitle')}>
                <div className="space-y-4">
                    <textarea
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        rows={4}
                        className="w-full p-2 border rounded-md"
                        placeholder={translate('community.post.commentPlaceholder')}
                    />
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>{translate('community.post.button.cancel')}</Button>
                        <Button onClick={handleConfirmEdit} disabled={actionLoading}>
                            {actionLoading ? <Spinner /> : translate('community.post.button.save')}
                        </Button>
                    </div>
                </div>
            </Modal>
            
            {/* Post Delete Modal */}
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title={translate('community.post.deleteTitle')}>
                <div className="space-y-4">
                    <p>{translate('community.post.deleteConfirm')}</p>
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>{translate('community.post.button.cancel')}</Button>
                        <Button className="bg-red-600 hover:bg-red-700 focus:ring-red-500" onClick={handleConfirmDelete} disabled={actionLoading}>
                            {actionLoading ? <Spinner /> : translate('community.post.button.delete')}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Connection Removal Modal */}
            <Modal isOpen={isRemoveModalOpen} onClose={() => setIsRemoveModalOpen(false)} title={translate('community.connections.removeConfirmTitle')}>
                <div className="space-y-4">
                    <SafeHTML as="p" html={translate('community.connections.removeConfirmText', { name: connectionToRemove?.name || connectionToRemove?.email?.split('@')[0] || '' })} />
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setIsRemoveModalOpen(false)}>{translate('community.post.button.cancel')}</Button>
                        <Button className="bg-red-600 hover:bg-red-700 focus:ring-red-500" onClick={handleConfirmRemove} disabled={removeLoading}>
                            {removeLoading ? <Spinner /> : translate('community.connections.button.remove')}
                        </Button>
                    </div>
                </div>
            </Modal>

            <div className="flex items-center mb-6">
                <Icon name="users" className="h-8 w-8 text-green-500 mr-3" />
                <div>
                    <h2 className="text-2xl font-bold text-gray-700">{translate('community.title')}</h2>
                    <p className="text-gray-600">{translate('community.description')}</p>
                </div>
            </div>

            {renderTabs()}
            
            {activeTab === 'Find Farmers' && (
                 <div className="mb-6 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Icon name="search" className="h-5 w-5 text-gray-400" /></div>
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={translate('community.find.searchPlaceholder')} className="w-full p-2 pl-10 border rounded-md" />
                </div>
            )}

            {error && <p className="text-red-500 text-center mb-4">{error}</p>}
            
            {loading || (activeTab === 'Community Feed' && feedLoading) ? (
                <div className="flex justify-center items-center h-48"><div className="w-8 h-8 border-2 border-green-500 border-dashed rounded-full animate-spin"></div></div>
            ) : (
                <div className="max-h-96 overflow-y-auto pr-2">
                   {renderContent()}
                </div>
            )}
        </Card>
    );
};

export default CommunityPage;
