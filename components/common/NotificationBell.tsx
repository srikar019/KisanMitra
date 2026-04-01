import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { updateConnectionRequestStatus } from '../../services/connectionService';
import { updateDealRequestStatus, updateDealNotificationStatus } from '../../services/marketplaceService';
import { respondToAgriSwapRequest, updateFinalizedAgriSwapDealStatus } from '../../services/barterService';
import { markMessagesAsRead } from '../../services/chatService';
import { markAlertAsRead } from '../../services/alertService';
import Icon from './Icon';
import { FarmerProfile, ChatNotification, Alert, ActiveView, AgriSwapDealRequest } from '../../types';

interface NotificationBellProps {
  onNavigateToChat: (recipient: FarmerProfile) => void;
  onNavigate: (view: ActiveView) => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigateToChat, onNavigate }) => {
  const { currentUser } = useAuth();
  const { pendingRequests, dealRequests, dealNotifications, chatNotifications, alerts, agriSwapDealRequests, finalizedAgriSwapDeals, requestCount } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const severityStyles: { [key in Alert['severity']]: { border: string, icon: string, iconColor: string } } = {
      info: { border: 'border-blue-500', icon: 'info', iconColor: 'text-blue-500' },
      warning: { border: 'border-yellow-500', icon: 'alert-triangle', iconColor: 'text-yellow-500' },
      danger: { border: 'border-red-500', icon: 'alert-octagon', iconColor: 'text-red-500' },
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConnectionAction = async (requestId: string, action: 'accepted' | 'rejected') => {
    try {
      await updateConnectionRequestStatus(requestId, action);
    } catch (error) {
      console.error(`Failed to ${action} request:`, error);
    }
  };
  
  const handleDealAction = async (dealId: string) => {
      try {
          await updateDealRequestStatus(dealId, 'read');
      } catch (error) {
          console.error(`Failed to dismiss deal notification:`, error);
      }
  };

  const handleAuthoredDealAction = async (notificationId: string) => {
    try {
      await updateDealNotificationStatus(notificationId, 'read');
    } catch (error) {
      console.error(`Failed to dismiss deal notification:`, error);
    }
  };

  const handleAgriSwapRequestAction = async (request: AgriSwapDealRequest, action: 'accepted' | 'rejected') => {
    try {
      await respondToAgriSwapRequest(request, action);
    } catch (error) {
      console.error(`Failed to ${action} barter request:`, error);
    }
  };

  const handleDismissFinalizedAgriSwapDeal = async (dealId: string) => {
    try {
        await updateFinalizedAgriSwapDealStatus(dealId, 'read');
    } catch (error) {
        console.error('Failed to dismiss finalized deal notification:', error);
    }
  };

  const handleChatClick = (notification: ChatNotification) => {
    onNavigateToChat({
        uid: notification.senderUid,
        email: notification.senderEmail,
        role: 'farmer'
    });
    setIsOpen(false);
  };

  const handleDismissChat = async (chatId: string) => {
    if (!currentUser) return;
    try {
        await markMessagesAsRead(chatId, currentUser.uid);
    } catch (error) {
        console.error('Failed to dismiss chat notification:', error);
    }
  };

  const handleAlertView = (alert: Alert) => {
      onNavigate(alert.relatedView);
      setIsOpen(false);
  };

  const handleAlertDismiss = async (alertId: string) => {
      if (!currentUser) return;
      try {
          await markAlertAsRead(currentUser.uid, alertId);
      } catch (error) {
          console.error('Failed to dismiss alert:', error);
      }
  };


  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label={`You have ${requestCount} new notifications.`}
      >
        <Icon name="bell" className="h-6 w-6 text-gray-600" />
        {requestCount > 0 && (
          <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 text-white text-[10px] ring-2 ring-white flex items-center justify-center">
            {requestCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border z-30">
          <div className="p-3 font-semibold border-b">Notifications</div>
          <div className="max-h-96 overflow-y-auto">
            {alerts.length > 0 && (
                <>
                    <div className="p-2 text-xs font-bold text-gray-500 bg-gray-100 sticky top-0 z-10">ALERTS</div>
                     <ul>
                        {alerts.map(alert => {
                            const styles = severityStyles[alert.severity as Alert['severity']] || severityStyles.info;
                            return (
                                <li key={alert.id} className={`p-3 border-b hover:bg-gray-50 border-l-4 ${styles.border}`}>
                                    <div className="flex items-start gap-2">
                                        <Icon name={styles.icon} className={`h-5 w-5 ${styles.iconColor} flex-shrink-0 mt-0.5`} />
                                        <p className="text-sm text-gray-700">{alert.message}</p>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button onClick={() => handleAlertView(alert)} className="px-3 py-1 text-xs font-semibold text-white bg-green-600 rounded-md hover:bg-green-700">View</button>
                                        <button onClick={() => handleAlertDismiss(alert.id)} className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Dismiss</button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
             {agriSwapDealRequests.length > 0 && (
                 <>
                    <div className="p-2 text-xs font-bold text-gray-500 bg-gray-100 sticky top-0 z-10">AGRI-SWAP REQUESTS</div>
                    <ul>
                        {agriSwapDealRequests.map(req => (
                        <li key={req.id} className="p-3 border-b hover:bg-gray-50">
                            <p className="text-sm">
                            <span className="font-semibold">{req.requesterName}</span> wants to trade for your <span className="font-semibold">{req.listingOfferItemName}</span>.
                            </p>
                            <div className="flex justify-end gap-2 mt-2">
                            <button onClick={() => handleAgriSwapRequestAction(req, 'accepted')} className="px-3 py-1 text-xs font-semibold text-white bg-green-600 rounded-md hover:bg-green-700">Accept</button>
                            <button onClick={() => handleAgriSwapRequestAction(req, 'rejected')} className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Reject</button>
                            </div>
                        </li>
                        ))}
                    </ul>
                 </>
            )}
            {finalizedAgriSwapDeals.length > 0 && (
                <>
                    <div className="p-2 text-xs font-bold text-gray-500 bg-gray-100 sticky top-0 z-10">AGRI-SWAP DEALS</div>
                     <ul>
                        {finalizedAgriSwapDeals.map(deal => (
                            <li key={deal.id} className="p-3 border-b hover:bg-gray-50">
                                <div className="flex items-start gap-2">
                                    <Icon name={'check-circle'} className={`h-5 w-5 text-cyan-500 flex-shrink-0 mt-0.5`} />
                                    <p className="text-sm text-gray-700">{deal.message}</p>
                                </div>
                                <div className="flex justify-end gap-2 mt-2">
                                    <button onClick={() => handleDismissFinalizedAgriSwapDeal(deal.id)} className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Dismiss</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {chatNotifications.length > 0 && (
                <>
                    <div className="p-2 text-xs font-bold text-gray-500 bg-gray-100 sticky top-0 z-10">MESSAGES</div>
                     <ul>
                        {chatNotifications.map(notif => (
                            <li key={notif.id} className="p-3 border-b hover:bg-gray-50">
                                <p className="text-sm">
                                    New message from <span className="font-semibold">{notif.senderEmail.split('@')[0]}</span>:
                                </p>
                                <p className="text-sm text-gray-600 italic truncate">"{notif.text}"</p>
                                <div className="flex justify-end gap-2 mt-2">
                                    <button onClick={() => handleChatClick(notif)} className="px-3 py-1 text-xs font-semibold text-white bg-green-600 rounded-md hover:bg-green-700">Chat</button>
                                    <button onClick={() => handleDismissChat(notif.id)} className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Dismiss</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {dealNotifications.length > 0 && (
                <>
                    <div className="p-2 text-xs font-bold text-gray-500 bg-gray-100 sticky top-0 z-10">AUTHORIZED DEALS</div>
                    <ul>
                        {dealNotifications.map(deal => (
                            <li key={deal.id} className="p-3 border-b hover:bg-gray-50">
                                <p className="text-sm">
                                    <span className="font-semibold text-green-700">Deal Closed!</span> {deal.message}
                                </p>
                                <div className="flex justify-end gap-2 mt-2">
                                    <button onClick={() => handleAuthoredDealAction(deal.id)} className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Dismiss</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {dealRequests.length > 0 && (
                <>
                    <div className="p-2 text-xs font-bold text-gray-500 bg-gray-100 sticky top-0 z-10">DEALS</div>
                    <ul>
                        {dealRequests.map(deal => (
                            <li key={deal.id} className="p-3 border-b hover:bg-gray-50">
                                <p className="text-sm">
                                    You have got a deal! <span className="font-semibold">{deal.customerEmail}</span> is interested in your <span className="font-semibold">{deal.product.cropName}</span>.
                                </p>
                                <div className="flex justify-end gap-2 mt-2">
                                    <button onClick={() => handleDealAction(deal.id)} className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Dismiss</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </>
            )}
             {pendingRequests.length > 0 && (
                 <>
                    <div className="p-2 text-xs font-bold text-gray-500 bg-gray-100 sticky top-0 z-10">CONNECTIONS</div>
                    <ul>
                        {pendingRequests.map(req => (
                        <li key={req.id} className="p-3 border-b hover:bg-gray-50">
                            <p className="text-sm">
                            <span className="font-semibold">{req.senderEmail.split('@')[0]}</span> wants to connect.
                            </p>
                            <div className="flex justify-end gap-2 mt-2">
                            <button onClick={() => handleConnectionAction(req.id, 'accepted')} className="px-3 py-1 text-xs font-semibold text-white bg-green-600 rounded-md hover:bg-green-700">Accept</button>
                            <button onClick={() => handleConnectionAction(req.id, 'rejected')} className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Reject</button>
                            </div>
                        </li>
                        ))}
                    </ul>
                 </>
            )}
            {requestCount === 0 && (
              <p className="p-4 text-sm text-gray-500 text-center">No new notifications.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
