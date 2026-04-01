import React, { useState, useEffect, useMemo } from 'react';
import { fetchIndianAgriNews } from '../services/apiClient';
import { postToFeed, onFeedSnapshot } from '../services/communityFeedService';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { IndianAgriNewsResponse, NewsArticle, GovernmentScheme, Incentive, WebSource, SharedContent, ContentType } from '../types';
import Card from './common/Card';
import Icon from './common/Icon';
import Spinner from './common/Spinner';
import Button from './common/Button';

type AgriNewsTab = 'News' | 'Schemes' | 'Incentives';

const AccordionItem: React.FC<{ title: string; children: React.ReactNode; startOpen?: boolean }> = ({ title, children, startOpen = false }) => {
    const [isOpen, setIsOpen] = useState(startOpen);

    return (
        <div className="border border-gray-200 rounded-lg bg-white">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-4 text-left font-semibold text-gray-700 hover:bg-gray-50"
                aria-expanded={isOpen}
            >
                <span>{title}</span>
                <svg
                    className={`w-5 h-5 text-gray-500 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
                    xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && (
                <div className="p-4 border-t border-gray-200 bg-gray-50/50">
                    {children}
                </div>
            )}
        </div>
    );
};

const ShareModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onShare: (comment: string) => void;
    item: SharedContent;
    itemType: ContentType;
    loading: boolean;
}> = ({ isOpen, onClose, onShare, item, itemType, loading }) => {
    const [comment, setComment] = useState('');

    if (!isOpen) return null;

    const title = (item as NewsArticle).title || (item as GovernmentScheme).name;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg relative">
                <div className="p-6">
                    <h3 className="text-lg font-bold text-gray-800">Share to Community Feed</h3>
                    <p className="text-sm text-gray-500 mt-1">Add an optional comment to your post.</p>
                    <div className="my-4 p-3 border rounded-md bg-gray-50">
                        <p className="font-semibold text-gray-700 truncate">{title}</p>
                        <p className="text-xs text-gray-500 capitalize">{itemType}</p>
                    </div>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={3}
                        placeholder="What are your thoughts? (Optional)"
                        className="w-full p-2 border rounded-md"
                    />
                </div>
                <div className="bg-gray-50 p-4 flex justify-end gap-3 rounded-b-lg">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => onShare(comment)} disabled={loading}>
                        {loading ? <Spinner /> : 'Share Post'}
                    </Button>
                </div>
            </div>
        </div>
    );
};


const IndianAgriNews: React.FC = () => {
    const { userProfile } = useAuth();
    const { translate, language } = useLanguage();
    const [data, setData] = useState<IndianAgriNewsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<AgriNewsTab>('News');
    
    const [locationQuery, setLocationQuery] = useState('');
    const [searchedLocation, setSearchedLocation] = useState('');
    const [topicQuery, setTopicQuery] = useState('');
    const [searchedTopic, setSearchedTopic] = useState('');
    const [timeQuery, setTimeQuery] = useState('');
    const [searchedTime, setSearchedTime] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    
    // New states for robust sharing logic
    const [sharingItemId, setSharingItemId] = useState<string | null>(null);
    const [recentlySharedItems, setRecentlySharedItems] = useState<Set<string>>(new Set());
    const [userSharedIdentifiers, setUserSharedIdentifiers] = useState<Set<string>>(new Set());
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [itemToShare, setItemToShare] = useState<{ item: SharedContent; type: ContentType } | null>(null);


    // Effect to fetch initial news data
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);
                setData(null);
                const result = await fetchIndianAgriNews(searchedLocation, searchedTopic, searchedTime, language);
                setData(result);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching news.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [searchedLocation, searchedTopic, searchedTime]);

    // Effect to listen for posts already shared by the current user for persistent UI state
    useEffect(() => {
        if (!userProfile) return;

        const unsub = onFeedSnapshot(
            (posts) => {
                const userPosts = posts.filter(p => p.senderUid === userProfile.uid);
                // The contentIdentifier might not exist on old posts, so filter for it.
                const identifiers = new Set(userPosts.map(p => p.contentIdentifier).filter(Boolean));
                setUserSharedIdentifiers(identifiers);
            },
            (err) => {
                console.error("Could not get user's shared items:", err);
                // Non-critical error, don't show to user. Backend check will still prevent duplicates.
            }
        );

        return () => unsub();
    }, [userProfile]);
    
    const handleLocationSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchedLocation(locationQuery);
        setSearchedTopic(topicQuery);
        setSearchedTime(timeQuery);
    };

    const filteredData = useMemo(() => {
        if (!data) return { news: [], schemes: [], incentives: [] };
        const lowercasedFilter = searchTerm.trim().toLowerCase();

        if (!lowercasedFilter) {
            return {
                news: data.news || [],
                schemes: data.schemes || [],
                incentives: data.incentives || [],
            };
        }

        const filterNews = (news: NewsArticle[]) => news.filter(article =>
            (article.title && article.title.toLowerCase().includes(lowercasedFilter)) ||
            (article.summary && article.summary.toLowerCase().includes(lowercasedFilter)) ||
            (article.source && article.source.toLowerCase().includes(lowercasedFilter))
        );

        const filterSchemes = (schemes: GovernmentScheme[]) => schemes.filter(scheme =>
            (scheme.name && scheme.name.toLowerCase().includes(lowercasedFilter)) ||
            (scheme.description && scheme.description.toLowerCase().includes(lowercasedFilter)) ||
            (Array.isArray(scheme.benefits) && scheme.benefits.join(' ').toLowerCase().includes(lowercasedFilter)) ||
            (scheme.eligibility && scheme.eligibility.toLowerCase().includes(lowercasedFilter))
        );

        const filterIncentives = (incentives: Incentive[]) => incentives.filter(incentive =>
            (incentive.name && incentive.name.toLowerCase().includes(lowercasedFilter)) ||
            (incentive.description && incentive.description.toLowerCase().includes(lowercasedFilter)) ||
            (incentive.eligibility && incentive.eligibility.toLowerCase().includes(lowercasedFilter))
        );

        return {
            news: filterNews(data.news || []),
            schemes: filterSchemes(data.schemes || []),
            incentives: filterIncentives(data.incentives || []),
        };
    }, [data, searchTerm]);


    const normalizeUrl = (url: string | undefined): string => {
        if (!url) return '#';
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
            return url;
        }
        return `https://${url}`;
    };

    const getHostname = (url: string | undefined): string => {
        if (!url) return 'Source';
        try {
            return new URL(normalizeUrl(url)).hostname;
        } catch (e) {
            return 'Invalid Source';
        }
    };
    
    const handleOpenShareModal = (item: SharedContent, type: ContentType) => {
        if (!userProfile?.name || !userProfile.email) {
            setError("Please set your name in your profile before sharing.");
            return;
        }
        setItemToShare({ item, type });
        setIsShareModalOpen(true);
    };

    const handleConfirmShare = async (comment: string) => {
        if (!itemToShare || !userProfile?.name || !userProfile.email) return;

        const { item, type } = itemToShare;
        const itemIdentifier = (item as NewsArticle).url || ('name' in item ? item.name : (item as NewsArticle).title);

        setSharingItemId(itemIdentifier);
        setError(null);

        try {
            await postToFeed(userProfile.uid, userProfile.name, userProfile.email, item, type, comment);
            
            setUserSharedIdentifiers(prev => new Set(prev).add(itemIdentifier));
            
            setRecentlySharedItems(prev => new Set(prev).add(itemIdentifier));
            setTimeout(() => {
                setRecentlySharedItems(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(itemIdentifier);
                    return newSet;
                });
            }, 3000);

            setIsShareModalOpen(false);
            setItemToShare(null);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to share.';
            setError(errorMessage);
            if (errorMessage.includes("already shared")) {
                setUserSharedIdentifiers(prev => new Set(prev).add(itemIdentifier));
                setIsShareModalOpen(false);
                setItemToShare(null);
            }
        } finally {
            setSharingItemId(null);
        }
    };

    const renderContent = () => {
        if (!data) return null;

        const NoResultsMessage = <p className="text-center text-gray-500 py-8">No results found for "{searchTerm}".</p>;

        switch (activeTab) {
            case 'News':
                const validNews = filteredData.news.filter(article => article.title && article.title.trim() !== '');
                if (validNews.length === 0) {
                    return searchTerm ? NoResultsMessage : <p className="text-center text-gray-500 py-8">No news articles found at the moment.</p>;
                }
                
                const topStories = validNews.slice(0, 10);

                return (
                    <div className="space-y-8">
                        {topStories.length > 0 && (
                            <div>
                                <h3 className="text-xl font-bold flex items-center text-gray-800 mb-6 border-b pb-2">
                                    <Icon name="trending-up" className="h-6 w-6 mr-2 text-green-600" /> Top Stories
                                </h3>
                                <div className="space-y-4">
                                    {topStories.map((article, index) => {
                                        const itemIdentifier = article.url || article.title;
                                        const isSharing = sharingItemId === itemIdentifier;
                                        const isRecentlyShared = recentlySharedItems.has(itemIdentifier);
                                        const hasBeenShared = userSharedIdentifiers.has(itemIdentifier);
                                        
                                        return (
                                            <div key={`top-${index}`} className="flex flex-col sm:flex-row p-5 border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-lg hover:border-green-300 transition-all duration-300 gap-4 justify-between">
                                                <div className="flex-grow">
                                                    <a href={normalizeUrl(article.url)} target="_blank" rel="noopener noreferrer" className="text-lg font-bold text-gray-800 hover:text-green-700 hover:underline line-clamp-2 mb-2 leading-snug">{article.title}</a>
                                                    <p className="text-xs font-bold text-green-700 mb-3 tracking-wider uppercase flex items-center gap-1">
                                                        <Icon name="clock" className="h-3 w-3" /> {article.publishedDate || "Recent"} 
                                                        <span className="text-gray-300 mx-1">•</span> 
                                                        <span className="text-gray-500">{article.source}</span>
                                                    </p>
                                                    <p className="text-gray-600 line-clamp-2 text-sm">{article.summary}</p>
                                                </div>
                                                <div className="mt-2 sm:mt-0 flex-shrink-0 flex items-center sm:items-start w-full sm:w-auto border-t sm:border-t-0 border-gray-100 pt-3 sm:pt-0">
                                                    <Button variant="secondary" className="!py-1.5 !px-4 !text-xs w-full sm:w-auto justify-center" onClick={() => handleOpenShareModal(article, 'news')} disabled={isSharing || hasBeenShared}>
                                                        {isSharing ? <Spinner /> : (isRecentlyShared || hasBeenShared) ? <><Icon name="check" className="h-4 w-4 mr-1"/> Shared</> : <><Icon name="share" className="h-4 w-4 mr-1"/> Share Story</>}
                                                    </Button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'Schemes':
                const validSchemes = filteredData.schemes.filter(scheme => scheme.name && scheme.name.trim() !== '');
                if (validSchemes.length === 0) {
                     return searchTerm ? NoResultsMessage : <p className="text-center text-gray-500 py-8">No government schemes found at the moment.</p>;
                }
                return (
                    <div className="space-y-4">
                        {validSchemes.map((scheme, index) => {
                            const itemIdentifier = scheme.name;
                            const isSharing = sharingItemId === itemIdentifier;
                            const isRecentlyShared = recentlySharedItems.has(itemIdentifier);
                            const hasBeenShared = userSharedIdentifiers.has(itemIdentifier);
                            return (
                            <AccordionItem key={index} title={scheme.name}>
                                <div className="space-y-3 text-sm">
                                    <p className="text-gray-600">{scheme.description}</p>
                                    <div>
                                        <h4 className="font-semibold text-gray-700">Benefits:</h4>
                                        <ul className="list-disc list-inside text-gray-600">
                                            {Array.isArray(scheme.benefits) && scheme.benefits.map((benefit, i) => <li key={i}>{benefit}</li>)}
                                        </ul>
                                    </div>
                                    <div><h4 className="font-semibold text-gray-700">Eligibility:</h4><p className="text-gray-600">{scheme.eligibility}</p></div>
                                    <div><h4 className="font-semibold text-gray-700">How to Apply:</h4><p className="text-gray-600">{scheme.howToApply}</p></div>
                                    <div className="flex justify-between items-center mt-2">
                                        <a href={normalizeUrl(scheme.officialLink)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">Official Link &rarr;</a>
                                         <Button variant="secondary" className="!py-1 !px-3 !text-xs" onClick={() => handleOpenShareModal(scheme, 'scheme')} disabled={isSharing || hasBeenShared}>
                                            {isSharing ? <Spinner /> : (isRecentlyShared || hasBeenShared) ? <><Icon name="check" className="h-4 w-4 mr-1"/> Shared</> : <><Icon name="share" className="h-4 w-4 mr-1"/> Share</>}
                                        </Button>
                                    </div>
                                </div>
                            </AccordionItem>
                        )})}
                    </div>
                );
            case 'Incentives':
                const validIncentives = filteredData.incentives.filter(incentive => incentive.name && incentive.name.trim() !== '');
                if (validIncentives.length === 0) {
                    return searchTerm ? NoResultsMessage : <p className="text-center text-gray-500 py-8">No incentives found at the moment.</p>;
                }
                return (
                    <div className="space-y-4">
                        {validIncentives.map((incentive, index) => {
                             const itemIdentifier = incentive.name;
                             const isSharing = sharingItemId === itemIdentifier;
                             const isRecentlyShared = recentlySharedItems.has(itemIdentifier);
                             const hasBeenShared = userSharedIdentifiers.has(itemIdentifier);
                             return (
                           <AccordionItem key={index} title={incentive.name}>
                                <div className="space-y-3 text-sm">
                                    <p className="text-gray-600">{incentive.description}</p>
                                     <div><h4 className="font-semibold text-gray-700">Benefit:</h4><p className="text-gray-600">{incentive.benefitAmount}</p></div>
                                    <div><h4 className="font-semibold text-gray-700">Eligibility:</h4><p className="text-gray-600">{incentive.eligibility}</p></div>
                                    <div><h4 className="font-semibold text-gray-700">Application Process:</h4><p className="text-gray-600">{incentive.applicationProcess}</p></div>
                                     <div className="flex justify-between items-center mt-2">
                                        <a href={normalizeUrl(incentive.link)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">Learn More &rarr;</a>
                                        <Button variant="secondary" className="!py-1 !px-3 !text-xs" onClick={() => handleOpenShareModal(incentive, 'incentive')} disabled={isSharing || hasBeenShared}>
                                            {isSharing ? <Spinner /> : (isRecentlyShared || hasBeenShared) ? <><Icon name="check" className="h-4 w-4 mr-1"/> Shared</> : <><Icon name="share" className="h-4 w-4 mr-1"/> Share</>}
                                        </Button>
                                    </div>
                                </div>
                            </AccordionItem>
                        )})}
                    </div>
                );
            default:
                return null;
        }
    };
    
    return (
        <Card>
            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                onShare={handleConfirmShare}
                item={itemToShare?.item!}
                itemType={itemToShare?.type!}
                loading={!!sharingItemId}
            />
            <div className="flex items-center mb-6">
                <Icon name="newspaper" className="h-8 w-8 text-green-600 mr-3" />
                <div>
                    <h2 className="text-2xl font-bold text-gray-700">{translate('news.title')}</h2>
                    <p className="text-gray-600">{translate('news.description')}</p>
                </div>
            </div>
            
            <form onSubmit={handleLocationSearch} className="my-6 flex flex-wrap gap-4 items-center bg-gray-50 p-4 rounded-lg border">
                <div className="flex-grow w-full md:w-auto min-w-[200px]">
                    <label htmlFor="location-search" className="sr-only">Search by State or Location</label>
                    <input
                        id="location-search"
                        type="text"
                        value={locationQuery}
                        onChange={(e) => setLocationQuery(e.target.value)}
                        placeholder="Location (e.g., Karnataka, Punjab)"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                        aria-label="Search by state or location"
                    />
                </div>
                <div className="flex-grow w-full md:w-auto min-w-[200px]">
                    <label htmlFor="topic-search" className="sr-only">Topic Filter</label>
                    <input
                        id="topic-search"
                        type="text"
                        value={topicQuery}
                        onChange={(e) => setTopicQuery(e.target.value)}
                        placeholder="Keyword (e.g., Wheat, Drones, Market)"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                        aria-label="Filter by Topic"
                    />
                </div>
                <div className="flex-grow w-full md:w-auto min-w-[200px]">
                    <label htmlFor="time-filter" className="sr-only">Time Filter</label>
                    <select
                        id="time-filter"
                        value={timeQuery}
                        onChange={(e) => setTimeQuery(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-700 bg-white"
                        aria-label="Filter by Time"
                    >
                        <option value="">Anytime</option>
                        <option value="1d">Past 24 Hours</option>
                        <option value="7d">Past Week</option>
                        <option value="30d">Past Month</option>
                        <option value="90d">Past 3 Months</option>
                        <option value="180d">Past 6 Months</option>
                    </select>
                </div>
                <button type="submit" disabled={loading} className="news-fetch-btn w-full md:w-auto px-6">
                    {loading ? <Spinner /> : 'Apply Filters'}
                </button>
            </form>

            <div className="mb-6 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon name="search" className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter results by crop, tech, etc..."
                    className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    aria-label="Filter current results"
                />
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="text-center">
                        <div className="w-12 h-12 mx-auto border-4 border-green-500 border-dashed rounded-full animate-spin"></div>
                        <p className="mt-4 text-gray-500">Fetching latest information {searchedLocation ? `for ${searchedLocation}` : 'for India'} {searchedTopic ? `about ${searchedTopic}` : ''}...</p>
                    </div>
                </div>
            ) : error ? (
                <div className="text-center text-red-600 bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="font-semibold">Error</p>
                    <p>{error}</p>
                </div>
            ) : (
                <>
                    {data && (
                        <div className="mb-4">
                            <h3 className="text-xl font-semibold text-gray-800">
                                {searchedLocation || searchedTopic ? `Showing results${searchedLocation ? ` for ${searchedLocation}` : ' Nationally'}${searchedTopic ? ` about ${searchedTopic}` : ''}` : 'Showing National Results'}
                            </h3>
                        </div>
                    )}
                    <div className="border-b border-gray-200 mb-6">
                        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                            {(['News', 'Schemes', 'Incentives'] as AgriNewsTab[]).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                                        activeTab === tab
                                            ? 'border-green-500 text-green-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </nav>
                    </div>
                    <div className="animate-fade-in">
                        {renderContent()}
                    </div>
                    {data?.sources && data.sources.length > 0 && (
                        <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                            <h4 className="text-md font-semibold text-gray-800">Data Sources</h4>
                            <p className="text-xs text-gray-500 mb-2">Information is grounded in the following real-time web search results:</p>
                            <ul className="list-disc list-inside text-sm space-y-1">
                                {data.sources?.map((source, index) => (
                                    <li key={index}>
                                        <a href={normalizeUrl(source.uri)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" title={source.uri}>
                                            {source.title || getHostname(source.uri)}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}
        </Card>
    );
};

export default IndianAgriNews;
